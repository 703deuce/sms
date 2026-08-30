/**
 * Verify MCTB Final Production Pipeline frozen state (DB + Telnyx + entry XML shape).
 *
 *   npm run verify:mctb-final-pipeline
 */
import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { loadMctbConsentMode } from "../src/lib/mctb/consent-prompt/service";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";
import {
  MCTB_FINAL_PIPELINE_ID,
  MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID,
  MCTB_FINAL_REFERENCE_DID,
  MCTB_FINAL_REFERENCE_PHONE_ID,
  MCTB_FINAL_REFERENCE_SMS_PHONE_ID,
  MCTB_FINAL_REFERENCE_WORKSPACE_ID,
  MCTB_FINAL_TEXML_APP_ID,
  MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID,
} from "../src/lib/mctb/texml-ingress/frozen-pipeline";
import { MCTB_TEXML_ROUTING_MODE, MCTB_TEXML_ROUTING_OWNER } from "../src/lib/mctb/texml-ingress/constants";
import { readPhoneCapabilities } from "../src/lib/numbers/phone-capabilities";

const E164 = process.env.PHONE_E164 || MCTB_FINAL_REFERENCE_DID;
const PHONE_ID = process.env.PHONE_866_ID || MCTB_FINAL_REFERENCE_PHONE_ID;
const WS = process.env.WORKSPACE_ID || MCTB_FINAL_REFERENCE_WORKSPACE_ID;

type Check = { name: string; ok: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_ID } });
  const telephony =
    phone?.settingsJson && typeof phone.settingsJson === "object"
      ? ((phone.settingsJson as Record<string, unknown>).telephony as Record<string, unknown>)
      : null;

  checks.push({
    name: "pipeline_id",
    ok: MCTB_FINAL_PIPELINE_ID === "mctb_texml_final_v1",
    detail: MCTB_FINAL_PIPELINE_ID,
  });
  checks.push({
    name: "db_routing_mode_mctb_texml",
    ok: telephony?.routingMode === MCTB_TEXML_ROUTING_MODE,
    detail: String(telephony?.routingMode || "missing"),
  });
  checks.push({
    name: "db_routing_owner",
    ok:
      telephony?.routingOwner === MCTB_TEXML_ROUTING_OWNER ||
      (phone?.settingsJson as Record<string, unknown>)?.routingOwner === MCTB_TEXML_ROUTING_OWNER,
    detail: String(telephony?.routingOwner || "missing"),
  });

  const caps = readPhoneCapabilities({ settingsJson: phone?.settingsJson });
  checks.push({
    name: "ai_after_hours_disabled",
    ok: caps.aiAfterHoursEnabled === false,
    detail: String(caps.aiAfterHoursEnabled),
  });

  const mctb = await loadMissedCallTextConfig(WS);
  checks.push({
    name: "mctb_voice_trigger_866",
    ok: mctb.phoneNumberId === PHONE_ID,
    detail: mctb.phoneNumberId || "null",
  });
  checks.push({
    name: "mctb_sms_sender_matches_voice",
    ok:
      Boolean(mctb.phoneNumberId) &&
      (mctb.smsPhoneNumberId === mctb.phoneNumberId ||
        mctb.smsPhoneNumberId === MCTB_FINAL_REFERENCE_SMS_PHONE_ID),
    detail: `voice=${mctb.phoneNumberId || "null"} sms=${mctb.smsPhoneNumberId || "null"}`,
  });

  const consentMode = await loadMctbConsentMode(WS);
  checks.push({
    name: "consent_mode_is_valid",
    ok: consentMode === "press_1" || consentMode === "existing_consent",
    detail: consentMode,
  });

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = listed.data?.[0];
  const connectionId = String(pn?.connection_id || "");
  checks.push({
    name: "telnyx_on_mctb_texml_app",
    ok: connectionId === MCTB_FINAL_TEXML_APP_ID,
    detail: `${connectionId} (${pn?.connection_name || ""})`,
  });

  const entryUrl = getTelnyxWebhookUrls().mctbEntry;

  const press1Res = await fetch(entryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164,
      CallSid: `verify-press1-${Date.now()}`,
    }),
  });
  const press1Xml = await press1Res.text();
  // Temporarily check press_1 shape via cert C3 if workspace is existing_consent
  const c3Url = `${entryUrl}?cert=C3`;
  const c3Res = await fetch(c3Url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164,
      CallSid: `verify-c3-${Date.now()}`,
    }),
  });
  const c3Xml = await c3Res.text();
  checks.push({
    name: "press1_texml_has_gather_and_consent_audio",
    ok:
      c3Res.ok &&
      c3Xml.includes("<Gather") &&
      c3Xml.includes(MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID),
    detail: c3Xml.slice(0, 200),
  });

  // existing_consent: entry without cert when workspace mode is existing_consent
  if (consentMode === "existing_consent") {
    checks.push({
      name: "existing_consent_texml_has_voicemail_audio",
      ok:
        press1Xml.includes("<Play>") &&
        press1Xml.includes(MCTB_FINAL_VOICEMAIL_GREETING_AUDIO_ASSET_ID) &&
        !press1Xml.includes("<Gather"),
      detail: press1Xml.slice(0, 200),
    });
  } else {
    checks.push({
      name: "existing_consent_texml_skipped",
      ok: true,
      detail: `workspace consentMode=${consentMode}; run prepare existing_consent to verify live`,
    });
  }

  const failed = checks.filter((c) => !c.ok);
  const report = {
    pipelineId: MCTB_FINAL_PIPELINE_ID,
    e164: E164,
    consentMode,
    entryUrl,
    ok: failed.length === 0,
    checks,
  };

  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
