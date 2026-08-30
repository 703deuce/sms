/**
 * Emergency: point 866 TeXML voice_url at a URL that preflights as valid XML.
 * Use when mctb-entry is not deployed yet — falls back to mctb-consent?say-only.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/hotfix-866-mctb-texml-voice-url.ts
 */
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import {
  preflightTexmlVoiceUrl,
  resolveMctbTexmlVoiceUrlCandidates,
} from "../src/lib/mctb/texml-ingress/preflight";
const E164 = process.env.PHONE_E164 || "+18663464256";
const PROVIDER_NUMBER_ID = process.env.PROVIDER_NUMBER_ID || "3015888798992041067";

async function main() {
  const candidates = resolveMctbTexmlVoiceUrlCandidates();
  const order = [
    { label: "mctb-entry", url: candidates.entry },
    { label: "mctb-consent-say-only", url: candidates.consentSayOnly },
    { label: "mctb-consent-cert-minimal", url: candidates.consentMinimal },
  ];

  let chosen: { label: string; url: string } | null = null;
  const reports = [];
  for (const c of order) {
    const pre = await preflightTexmlVoiceUrl(c.url);
    const isMinimalSay =
      pre.ok &&
      !pre.bodyPreview.includes("<Gather") &&
      pre.bodyPreview.includes("<Say");
    const accepted = pre.ok && (c.label !== "mctb-consent-cert-minimal" || isMinimalSay);
    reports.push({ ...c, pre, accepted });
    if (accepted && !chosen) chosen = c;
  }

  console.log(JSON.stringify({ preflight: reports }, null, 2));

  if (!chosen) {
    throw new Error("No TeXML voice_url candidate passed preflight — refusing to update Telnyx");
  }

  const texmlAppId =
    process.env.MCTB_TEXML_APP_ID?.trim() || "3037587396909598261";

  await telnyxRequest(`/texml_applications/${encodeURIComponent(texmlAppId)}`, {
    method: "PATCH",
    body: {
      voice_url: chosen.url,
      voice_method: "POST",
      active: true,
    },
  });

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(PROVIDER_NUMBER_ID)}`, {
    method: "PATCH",
    body: { connection_id: texmlAppId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers`,
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = verify.data?.[0];

  console.log(
    JSON.stringify(
      {
        ok: true,
        chosenVoiceUrl: chosen.url,
        chosenLabel: chosen.label,
        texmlAppId,
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
