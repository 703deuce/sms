/**
 * Repoint any MCTB DID to the frozen certified TeXML ingress (same as 866).
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/repoint-mctb-frozen-texml-ingress.ts
 *
 * Optional:
 *   PHONE_NUMBER_ID=cmsgtjms84g6l2h0o255w1e3v WORKSPACE_ID=ws_1
 */
import { getPrisma } from "../src/lib/db";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import { provisionMctbPhoneTexmlIngressModeForWorkspace } from "../src/lib/mctb/texml-ingress/texml-mode-provision";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_NUMBER_ID =
  process.env.PHONE_NUMBER_ID || "cmsgtjms84g6l2h0o255w1e3v";

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_NUMBER_ID, workspaceId: WORKSPACE_ID },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    throw new Error("Phone not found or missing providerNumberId");
  }

  const result = await provisionMctbPhoneTexmlIngressModeForWorkspace(
    WORKSPACE_ID,
    phone.id,
  );
  if (!result) throw new Error("Provision returned null");

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`,
  );
  const row = verify.data || verify;
  const liveConnectionId = String(row.connection_id || "");
  const connectionName = String(row.connection_name || "");

  console.log(
    JSON.stringify(
      {
        ok: liveConnectionId === result.texmlAppId,
        e164: phone.e164,
        expectedAppId: result.texmlAppId,
        expectedVoiceUrl: result.voiceUrl,
        frozenDefaultAppId: MCTB_TEXML_DEFAULT_APP_ID,
        liveConnectionId,
        connectionName,
        handlerMode: result.handlerMode,
      },
      null,
      2,
    ),
  );

  if (liveConnectionId !== result.texmlAppId) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
