/**
 * Point +15717491060 at OpenAI Live SIP (Voice V3 Basic) — not Call Control / TeXML / media WS.
 *
 * Requires:
 *   OPENAI_PROJECT_ID=proj_...  (OpenAI Project → General)
 *   OPENAI_API_KEY
 *   TELNYX_API_KEY (via existing telnyx client env)
 *
 * OpenAI dashboard (manual):
 *   Project → Webhooks → subscribe live.transport.incoming
 *   URL: https://<APP_HOST>/api/openai/live/incoming
 *   Set OPENAI_WEBHOOK_SECRET in production to match.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/setup-voice-v3-basic-5717491060.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getAppBaseUrl } from "../src/lib/messaging/telnyx/config";
import { findFqdnConnectionByName } from "../src/lib/telephony/provisioning/telnyx/sip-connection";

const E164 = process.env.PHONE_E164?.trim() || "+15717491060";
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID?.trim();
const CONNECTION_NAME =
  process.env.VOICE_V3_BASIC_TELNYX_FQDN_NAME?.trim() || "Transovo Voice V3 Basic OpenAI Live SIP";
const OPENAI_SIP_HOST = process.env.OPENAI_SIP_HOST?.trim() || "sip.api.openai.com";

function openAiSipUri(projectId: string): string {
  return `sip:${projectId}@${OPENAI_SIP_HOST};transport=tls`;
}

async function ensureOpenAiFqdnConnection(projectId: string): Promise<string> {
  let conn = await findFqdnConnectionByName(CONNECTION_NAME);
  if (!conn?.id) {
    const created = await telnyxRequest<{ data?: Record<string, unknown> }>("/fqdn_connections", {
      method: "POST",
      body: {
        active: true,
        anchorsite_override: "Latency",
        connection_name: CONNECTION_NAME,
        inbound: {
          ani_number_format: "+E.164",
          dnis_number_format: "+e164",
        },
        transport_protocol: "TLS",
      },
    });
    conn = created.data ?? null;
    console.log("Created Telnyx FQDN connection", CONNECTION_NAME, conn?.id);
  }

  const connectionId = String(conn?.id || "");
  if (!connectionId) throw new Error("FQDN connection missing id");

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": connectionId },
  });
  const rows = listed.data || [];
  let fqdnRow = rows.find((r) => String(r.fqdn || "").toLowerCase() === OPENAI_SIP_HOST.toLowerCase());

  if (!fqdnRow?.id) {
    const createdFqdn = await telnyxRequest<{ data?: Record<string, unknown> }>("/fqdns", {
      method: "POST",
      body: {
        connection_id: connectionId,
        fqdn: OPENAI_SIP_HOST,
        port: 5061,
        dns_record_type: "a",
      },
    });
    fqdnRow = createdFqdn.data;
    console.log("Created FQDN record", OPENAI_SIP_HOST, fqdnRow?.id);
  }

  const fqdnId = String(fqdnRow?.id || "");
  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(connectionId)}`, {
    method: "PATCH",
    body: {
      inbound: {
        default_primary_fqdn_id: fqdnId,
        dnis_number_format: "+e164",
      },
    },
  });

  return connectionId;
}

async function main() {
  if (!OPENAI_PROJECT_ID || !OPENAI_PROJECT_ID.startsWith("proj_")) {
    throw new Error("Set OPENAI_PROJECT_ID=proj_... from OpenAI Project → General");
  }

  const appUrl = getAppBaseUrl().replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/openai/live/incoming`;

  console.log("VOICE_V3_BASIC_CONFIG", {
    frontend: "gpt-live-1",
    backend: "gpt-6-astra",
    e164: E164,
    openAiSipUri: openAiSipUri(OPENAI_PROJECT_ID),
    webhookUrl,
  });

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: E164 },
    select: { id: true, workspaceId: true, providerNumberId: true, e164: true, metadata: true },
  });
  if (!phone?.providerNumberId) {
    throw new Error(`Phone ${E164} not found in DB or missing providerNumberId`);
  }

  const connectionId = await ensureOpenAiFqdnConnection(OPENAI_PROJECT_ID);

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });

  const prevMeta = (phone.metadata && typeof phone.metadata === "object" ? phone.metadata : {}) as Record<
    string,
    unknown
  >;
  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      metadata: {
        ...prevMeta,
        voiceV3Basic: true,
        voiceV3BasicSip: openAiSipUri(OPENAI_PROJECT_ID),
        voiceV3BasicTelnyxConnectionId: connectionId,
        voiceV3BasicConfiguredAt: new Date().toISOString(),
      } as object,
    },
  });

  console.log("VOICE_V3_BASIC_TELNYX_READY", {
    e164: E164,
    telnyxConnectionId: connectionId,
    telnyxConnectionName: CONNECTION_NAME,
    note: "Number must NOT use Call Control, TeXML, or media-stream apps for inbound PSTN.",
  });
  console.log("OPENAI_WEBHOOK_SETUP", {
    subscribe: ["live.transport.incoming"],
    url: webhookUrl,
    webhookSecretEnv: "OPENAI_WEBHOOK_SECRET",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
