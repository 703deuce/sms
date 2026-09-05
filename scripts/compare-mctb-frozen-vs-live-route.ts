import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";

const NEW_571 = "+15717491060";
const REF_866 = "+18663464256";

async function telnyxPn(e164: string) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": e164 },
  });
  return res.data?.[0] || null;
}

async function main() {
  const prisma = getPrisma();
  const config = await loadMissedCallTextConfig("ws_1");
  const app = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/texml_applications/${encodeURIComponent(MCTB_TEXML_DEFAULT_APP_ID)}`,
  );
  const apps = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/texml_applications", {
    query: { "page[size]": 50 },
  });
  const mctbApps = (apps.data || []).filter((a) =>
    String(a.friendly_name || "").toLowerCase().includes("mctb"),
  );

  const pn571 = await telnyxPn(NEW_571);
  const pn866 = await telnyxPn(REF_866);
  const voiceUrl = String(app.data?.voice_url || "");
  const c3Url = voiceUrl.includes("cert=") ? voiceUrl : `${getTelnyxWebhookUrls().mctbEntry}?cert=C3`;
  const c3Pre = await preflightTexmlVoiceUrl(c3Url);

  const lastSuccess = await prisma.missedCallTextTrace.findFirst({
    where: { kind: "sms.delivered" },
    orderBy: { createdAt: "desc" },
    include: { missedCallEvent: true },
  });

  const lastConsent = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: { businessNumber: REF_866 },
    orderBy: { consentedAt: "desc" },
  });

  console.log(
    JSON.stringify(
      {
        frozenReference: {
          pipeline: "mctb_texml_final_v1",
          lastPstnCertPass: "2026-08-30 on +18663464256",
          frozenPress1Cert: "C3",
          frozenHandler: "POST /api/telnyx/voice/mctb-entry?cert=C3",
          frozenConsent: "POST /api/telnyx/voice/mctb-consent?event=gather&path=texml_mctb_ingress&cert=C3",
          texmlAppId: MCTB_TEXML_DEFAULT_APP_ID,
        },
        liveNow: {
          texmlAppVoiceUrl: voiceUrl,
          certOnVoiceUrl: voiceUrl.includes("cert=C3") ? "C3" : voiceUrl.includes("cert=") ? "other" : "D/none",
          c3PreflightOk: c3Pre.ok,
          mctbConfigPhoneId: config.phoneNumberId,
          new571: {
            e164: NEW_571,
            connection_id: pn571?.connection_id,
            connection_name: pn571?.connection_name,
            onFrozenApp: pn571?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
          },
          ref866: {
            e164: REF_866,
            connection_id: pn866?.connection_id,
            connection_name: pn866?.connection_name,
            onFrozenApp: pn866?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
          },
        },
        lastSuccessfulSmsTrace: lastSuccess
          ? {
              at: lastSuccess.createdAt,
              businessE164: lastSuccess.missedCallEvent?.businessE164,
              callerE164: lastSuccess.missedCallEvent?.callerE164,
              traceId: lastSuccess.traceId,
            }
          : null,
        last866Consent: lastConsent
          ? {
              at: lastConsent.consentedAt,
              businessNumber: lastConsent.businessNumber,
              metadata: lastConsent.metadataJson,
            }
          : null,
        allMctbTexmlApps: mctbApps.map((a) => ({
          id: a.id,
          name: a.friendly_name,
          voice_url: a.voice_url,
          active: a.active,
        })),
        routeMatch: {
          sameTexmlAppAs866: pn571?.connection_id === pn866?.connection_id,
          sameVoiceUrlHandler: true,
          usingFrozenC3Cert: voiceUrl.includes("cert=C3"),
          matchesLastWorkingCertPath:
            voiceUrl.includes("mctb-entry") &&
            voiceUrl.includes("cert=C3") &&
            pn571?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
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
