/**
 * One-shot: lock any MCTB DID on the frozen certified TeXML ingress (same recipe as 866).
 *
 * Defaults to ws_1 production voice DID 571 (+15714073615).
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/apply-frozen-mctb-texml-ingress.ts
 *
 * Optional:
 *   PHONE_NUMBER_ID=cmsgtjms84g6l2h0o255w1e3v WORKSPACE_ID=ws_1 CERT=D
 */
import { getPrisma } from "../src/lib/db";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";
import {
  MCTB_FINAL_PRODUCTION_CERT_MODE,
  MCTB_WS1_PRODUCTION_VOICE_PHONE_ID,
} from "../src/lib/mctb/texml-ingress/frozen-pipeline";
import { mctbEntryVoiceUrlWithCert } from "../src/lib/mctb/texml-ingress/cert-mode";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";
import { switchDidToMctbTexmlIngress } from "../src/lib/mctb/texml-ingress/provision";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || MCTB_WS1_PRODUCTION_VOICE_PHONE_ID;
const TEXML_APP_ID = process.env.MCTB_TEXML_APP_ID?.trim() || MCTB_TEXML_DEFAULT_APP_ID;
const CERT = (process.env.CERT || process.argv[2] || MCTB_FINAL_PRODUCTION_CERT_MODE).trim();

async function clearAgentClaims(prisma: ReturnType<typeof getPrisma>, phoneNumberId: string) {
  const clearedJoins = await prisma.voiceAgentPhoneNumber.deleteMany({
    where: { phoneNumberId },
  });

  const clearedAgents = await prisma.voiceAgent.updateMany({
    where: { workspaceId: WORKSPACE_ID, phoneNumberId },
    data: { phoneNumberId: null },
  });

  const agentsWithLink = await prisma.voiceAgent.findMany({
    where: { workspaceId: WORKSPACE_ID },
    select: { id: true, linkedPhoneNumberIds: true },
  });
  let linkedCleared = 0;
  for (const agent of agentsWithLink) {
    const ids = Array.isArray(agent.linkedPhoneNumberIds) ? agent.linkedPhoneNumberIds : [];
    if (!ids.includes(phoneNumberId)) continue;
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        linkedPhoneNumberIds: ids.filter((id) => id !== phoneNumberId),
      },
    });
    linkedCleared += 1;
  }

  return { clearedJoins: clearedJoins.count, clearedAgents: clearedAgents.count, linkedCleared };
}

async function applyCertMode() {
  const baseEntry = getTelnyxWebhookUrls().mctbEntry;
  const voiceUrl = mctbEntryVoiceUrlWithCert(baseEntry, CERT);
  const pre = await preflightTexmlVoiceUrl(voiceUrl);
  if (!pre.ok && process.env.SKIP_TEXML_PREFLIGHT !== "1") {
    throw new Error(`Preflight failed for ${voiceUrl}: ${pre.error}`);
  }

  await telnyxRequest(`/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`, {
    method: "PATCH",
    body: {
      voice_url: voiceUrl,
      voice_method: "POST",
      active: true,
    },
  });

  return { cert: CERT, voiceUrl, preflight: pre };
}

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_NUMBER_ID, workspaceId: WORKSPACE_ID },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    throw new Error("Phone not found or missing providerNumberId");
  }

  console.log("=== Before apply frozen ingress ===");
  console.log(JSON.stringify({ e164: phone.e164, settingsJson: phone.settingsJson }, null, 2));

  const cleared = await clearAgentClaims(prisma, PHONE_NUMBER_ID);
  console.log("Cleared agent claims:", cleared);

  const switchResult = await switchDidToMctbTexmlIngress({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    preferredTexmlAppId: TEXML_APP_ID,
  });

  const cert = await applyCertMode();

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": phone.e164 } },
  );
  const pn = listed.data?.[0];

  const after = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_NUMBER_ID, workspaceId: WORKSPACE_ID },
  });

  console.log(
    JSON.stringify(
      {
        ok: switchResult.ok && switchResult.verify.ok && pn?.connection_id === TEXML_APP_ID,
        e164: phone.e164,
        phoneNumberId: PHONE_NUMBER_ID,
        cleared,
        switch: {
          texmlAppId: switchResult.texmlRoute.texmlAppId,
          verify: switchResult.verify,
        },
        cert,
        telnyxNumber: {
          connection_id: pn?.connection_id,
          connection_name: pn?.connection_name,
        },
        dbRouting: (after?.settingsJson as Record<string, unknown>)?.telephony,
        routingOwner: (after?.settingsJson as Record<string, unknown>)?.routingOwner,
        aiAfterHoursEnabled: after?.settingsJson
          ? readPhoneCapabilities({ settingsJson: after.settingsJson }).aiAfterHoursEnabled
          : null,
      },
      null,
      2,
    ),
  );

  if (!switchResult.verify.ok || pn?.connection_id !== TEXML_APP_ID) process.exit(1);
  console.log(
    `\nREADY — ${phone.e164} locked to frozen MCTB TeXML (app ${TEXML_APP_ID}, cert ${CERT}). Same binding as 866.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
