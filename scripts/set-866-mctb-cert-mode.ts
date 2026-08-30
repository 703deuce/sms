/**
 * Switch 866 MCTB TeXML cert stage via Telnyx voice_url query param — no env vars, no redeploy.
 *
 * Usage:
 *   npx tsx scripts/set-866-mctb-cert-mode.ts A    # Say "Test successful."
 *   npx tsx scripts/set-866-mctb-cert-mode.ts B    # Gather + Say + press 1
 *   npx tsx scripts/set-866-mctb-cert-mode.ts B2   # Play consent audio only (media cert)
 *   npx tsx scripts/set-866-mctb-cert-mode.ts B3   # Gather + Play + press 1
 *   npx tsx scripts/set-866-mctb-cert-mode.ts C    # Gather + press 1 + test SMS
 *   npx tsx scripts/set-866-mctb-cert-mode.ts D    # production (no ?cert= on URL)
 *
 * Requires: TELNYX_API_KEY, APP_URL (or NEXT_PUBLIC_APP_URL)
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { mctbEntryVoiceUrlWithCert } from "../src/lib/mctb/texml-ingress/cert-mode";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";

const E164 = process.env.PHONE_E164 || "+18663464256";
const PROVIDER_NUMBER_ID = process.env.PROVIDER_NUMBER_ID || "3015888798992041067";
const TEXML_APP_ID = process.env.MCTB_TEXML_APP_ID?.trim() || "3037587396909598261";

async function main() {
  const cert = (process.argv[2] || process.env.CERT || "D").trim();
  const baseEntry = getTelnyxWebhookUrls().mctbEntry;
  const voiceUrl = mctbEntryVoiceUrlWithCert(baseEntry, cert);

  const pre = await preflightTexmlVoiceUrl(voiceUrl);
  console.log(JSON.stringify({ cert, voiceUrl, preflight: pre }, null, 2));

  if (!pre.ok) {
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

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(PROVIDER_NUMBER_ID)}`, {
    method: "PATCH",
    body: { connection_id: TEXML_APP_ID },
  });

  const verify = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = verify.data?.[0];

  console.log(
    JSON.stringify(
      {
        ok: true,
        cert,
        voiceUrl,
        texmlAppId: TEXML_APP_ID,
        telnyxNumber: {
          connection_id: pn?.connection_id,
          connection_name: pn?.connection_name,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
