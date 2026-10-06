/**
 * Verify MCTB Final Production Pipeline frozen state (DB + Telnyx + entry XML shape).
 *
 *   npm run verify:mctb-final-pipeline
 *
 * Default target: workspace MCTB voice trigger from `loadMissedCallTextConfig` (not the
 * historical Aug-2026 cert DID). Override with WORKSPACE_ID, PHONE_866_ID, PHONE_E164.
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
import { isSupabaseConfigured } from "../src/lib/supabase/admin";
import { runMctbDeterministicFirstTextChecks } from "./lib/mctb-deterministic-first-text-verify";

const WS = process.env.WORKSPACE_ID || MCTB_FINAL_REFERENCE_WORKSPACE_ID;

type IngressResolveSource = "env_override" | "workspace_config" | "frozen_reference_fallback";

type Check = { name: string; ok: boolean; detail?: string };

async function resolveIngressTarget(prisma: ReturnType<typeof getPrisma>) {
  const mctb = await loadMissedCallTextConfig(WS);
  let phoneId: string;
  let resolveSource: IngressResolveSource;

  if (process.env.PHONE_866_ID?.trim()) {
    phoneId = process.env.PHONE_866_ID.trim();
    resolveSource = "env_override";
  } else if (mctb.phoneNumberId) {
    phoneId = mctb.phoneNumberId;
    resolveSource = "workspace_config";
  } else {
    phoneId = MCTB_FINAL_REFERENCE_PHONE_ID;
    resolveSource = "frozen_reference_fallback";
  }

  let e164 = process.env.PHONE_E164?.trim() || "";
  if (!e164) {
    const row = await prisma.phoneNumber.findUnique({
      where: { id: phoneId },
      select: { e164: true },
    });
    e164 = row?.e164 || MCTB_FINAL_REFERENCE_DID;
  }

  return { mctb, phoneId, e164, resolveSource };
}

async function main() {
  const checks: Check[] = [...runMctbDeterministicFirstTextChecks()];

  if (!isSupabaseConfigured()) {
    const failed = checks.filter((c) => !c.ok);
    const report = {
      pipelineId: MCTB_FINAL_PIPELINE_ID,
      workspaceId: WS,
      ok: failed.length === 0,
      skipped: "live_db_telnyx_checks_require_supabase",
      checks,
    };
    console.log(JSON.stringify(report, null, 2));
    if (failed.length) process.exit(1);
    return;
  }

  const prisma = getPrisma();
  const { mctb, phoneId: PHONE_ID, e164: E164, resolveSource } = await resolveIngressTarget(prisma);

  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_ID } });
  const settingsJson =
    phone?.settingsJson && typeof phone.settingsJson === "object"
      ? (phone.settingsJson as Record<string, unknown>)
      : null;
  const telephony = settingsJson?.telephony as Record<string, unknown> | undefined;
  const routingMode = String(telephony?.routingMode || settingsJson?.routingOwner || "");
  const routingOwner = String(telephony?.routingOwner || settingsJson?.routingOwner || "");

  checks.push({
    name: "pipeline_id",
    ok: MCTB_FINAL_PIPELINE_ID === "mctb_texml_final_v1",
    detail: MCTB_FINAL_PIPELINE_ID,
  });
  checks.push({
    name: "ingress_resolve_source",
    ok: resolveSource !== "frozen_reference_fallback",
    detail: `${resolveSource} (historical cert DID ${MCTB_FINAL_REFERENCE_DID} is not the default target)`,
  });
  checks.push({
    name: "db_routing_mode_mctb_texml",
    ok: routingMode === MCTB_TEXML_ROUTING_MODE,
    detail: routingMode || "missing",
  });
  checks.push({
    name: "db_routing_owner",
    ok: routingOwner === MCTB_TEXML_ROUTING_OWNER,
    detail: routingOwner || "missing",
  });

  const caps = readPhoneCapabilities({ settingsJson: phone?.settingsJson });
  checks.push({
    name: "ai_after_hours_disabled",
    ok: caps.aiAfterHoursEnabled === false,
    detail: String(caps.aiAfterHoursEnabled),
  });

  checks.push({
    name: "mctb_voice_trigger_matches_workspace",
    ok: Boolean(mctb.phoneNumberId) && mctb.phoneNumberId === PHONE_ID,
    detail: `config=${mctb.phoneNumberId || "null"} verify=${PHONE_ID}`,
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
  if (consentMode === "press_1") {
    checks.push({
      name: "press1_texml_has_gather_and_consent_audio",
      ok:
        press1Res.ok &&
        press1Xml.includes("<Gather") &&
        press1Xml.includes(MCTB_FINAL_PRESS1_CONSENT_AUDIO_ASSET_ID),
      detail: press1Xml.slice(0, 200),
    });
  } else {
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
      name: "press1_texml_skipped",
      ok: true,
      detail: `workspace consentMode=${consentMode}; C3 probe=${c3Xml.slice(0, 80)}`,
    });
  }

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
    workspaceId: WS,
    ingressResolveSource: resolveSource,
    historicalCertDid: MCTB_FINAL_REFERENCE_DID,
    phoneNumberId: PHONE_ID,
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
