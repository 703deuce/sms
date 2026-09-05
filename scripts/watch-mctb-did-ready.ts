/**
 * Poll until a new MCTB DID looks ready for inbound CFNA testing.
 *
 * Static checks (Telnyx status, TeXML route, entry probe) run every poll.
 * After you place a real call, --watch also detects a successful SIP CDR (answered, no 480).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/watch-mctb-did-ready.ts
 *
 *   ... --watch --interval 30
 *   ... --e164 +15717491060
 */
import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { isPhoneAuthorizedForOutboundSms } from "../src/lib/mctb/messaging/outbound-sms-route";
import { mctbEntryVoiceUrlWithCert } from "../src/lib/mctb/texml-ingress/cert-mode";
import { MCTB_TEXML_DEFAULT_APP_ID } from "../src/lib/mctb/texml-ingress/constants";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";

const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const INTERVAL_SEC = Number(args.find((a) => a.startsWith("--interval="))?.split("=")[1] || "30");
const E164 = args.find((a) => a.startsWith("+")) || process.env.PHONE_E164 || "+15717491060";
const CERT = process.env.CERT || "C3";

type Check = { name: string; ok: boolean; detail: string };

async function telnyxPn(e164: string) {
  const res = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/phone_numbers", {
    query: { "filter[phone_number]": e164 },
  });
  return res.data?.[0] || null;
}

async function latestInboundCdr(e164: string) {
  const sip = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/detail_records", {
    query: {
      "filter[record_type]": "sip-trunking",
      "filter[cld]": e164,
      "page[size]": 3,
    },
  });
  return sip.data?.[0] || null;
}

async function runChecks(): Promise<{
  checks: Check[];
  readyForStaticTest: boolean;
  liveCallProof: boolean;
  voiceUrl: string;
}> {
  const prisma = getPrisma();
  const config = await loadMissedCallTextConfig("ws_1");
  const phone = await prisma.phoneNumber.findFirst({ where: { e164: E164 } });
  const pn = await telnyxPn(E164);
  const app = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/texml_applications/${encodeURIComponent(MCTB_TEXML_DEFAULT_APP_ID)}`,
  );

  const voiceUrl = mctbEntryVoiceUrlWithCert(getTelnyxWebhookUrls().mctbEntry, CERT);
  const entryProbe = await fetch(voiceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164,
      CallSid: `ready-watch-${Date.now()}`,
    }),
  });
  const entryXml = await entryProbe.text();
  const smsAuth = phone ? await isPhoneAuthorizedForOutboundSms(phone.id) : null;
  const cdr = await latestInboundCdr(E164);

  const cdrOk =
    Boolean(cdr) &&
    Number(cdr.call_sec || 0) > 0 &&
    String(cdr.sip_invite_failure_status || "") !== "480" &&
    String(cdr.hangup_cause || "").toUpperCase() === "NORMAL_CLEARING";

  const checks: Check[] = [
    {
      name: "telnyx_number_status_active",
      ok: String(pn?.status || "").toLowerCase() === "active",
      detail: String(pn?.status || "missing"),
    },
    {
      name: "telnyx_on_mctb_texml_app",
      ok: pn?.connection_id === MCTB_TEXML_DEFAULT_APP_ID,
      detail: `${pn?.connection_name || "none"} (${pn?.connection_id || "none"})`,
    },
    {
      name: "texml_app_voice_url_frozen_cert",
      ok: String(app.data?.voice_url || "").includes(`cert=${CERT}`),
      detail: String(app.data?.voice_url || "missing"),
    },
    {
      name: "mctb_config_points_at_did",
      ok: config.phoneNumberId === phone?.id && config.smsPhoneNumberId === phone?.id,
      detail: `voice=${config.phoneNumberId || "null"} sms=${config.smsPhoneNumberId || "null"} did=${phone?.id || "null"}`,
    },
    {
      name: "entry_probe_gather_play",
      ok: entryProbe.ok && entryXml.includes("<Gather") && entryXml.includes("<Play"),
      detail: `status=${entryProbe.status} gather=${entryXml.includes("<Gather")} play=${entryXml.includes("<Play")}`,
    },
    {
      name: "sms_outbound_authorized",
      ok: Boolean(smsAuth?.allowed),
      detail: smsAuth ? `${smsAuth.regime} allowed=${smsAuth.allowed}` : "no phone row",
    },
    {
      name: "live_inbound_cdr_proof",
      ok: cdrOk,
      detail: cdr
        ? `at=${cdr.started_at} duration=${cdr.call_sec}s sip_fail=${cdr.sip_invite_failure_status || "-"} hangup=${cdr.hangup_cause}`
        : "no inbound CDR yet — dial the number once to confirm answer",
    },
  ];

  const staticNames = checks.filter((c) => c.name !== "live_inbound_cdr_proof").map((c) => c.name);
  const readyForStaticTest = staticNames.every((name) => checks.find((c) => c.name === name)?.ok);

  return {
    checks,
    readyForStaticTest,
    liveCallProof: cdrOk,
    voiceUrl,
  };
}

function printResult(result: Awaited<ReturnType<typeof runChecks>>, at: Date) {
  const card = {
    at: at.toISOString(),
    e164: E164,
    cert: CERT,
    readyForStaticTest: result.readyForStaticTest,
    liveCallProof: result.liveCallProof,
    fullyReady: result.readyForStaticTest && result.liveCallProof,
    checks: result.checks,
    nextStep: result.readyForStaticTest
      ? result.liveCallProof
        ? "READY — CFNA forward test should work. Use *61*5717491060*10#"
        : "Static wiring OK. Dial +15717491060 directly (or CFNA test) — re-run with --watch to detect answered CDR."
      : "Not ready — fix failing checks above, then re-run.",
    manualTest: {
      directDial: E164,
      attCfna: "*61*5717491060*10#",
      expected: "Hear press-1 consent prompt, then press 1 for SMS",
    },
  };
  console.log(JSON.stringify(card, null, 2));
  return card.fullyReady;
}

async function main() {
  if (!WATCH) {
    const ready = printResult(await runChecks(), new Date());
    process.exit(ready ? 0 : 1);
  }

  console.log(
    JSON.stringify(
      {
        mode: "watch",
        e164: E164,
        intervalSec: INTERVAL_SEC,
        note: "Static checks every poll. Place a test call anytime — script exits when answered CDR detected.",
      },
      null,
      2,
    ),
  );

  for (;;) {
    const result = await runChecks();
    const done = printResult(result, new Date());
    if (done) {
      console.log("\n✅ DID fully ready (static + live CDR proof).");
      process.exit(0);
    }
    if (result.readyForStaticTest) {
      console.log("\n⏳ Static wiring ready — waiting for answered inbound call proof...");
    } else {
      console.log("\n⏳ Still waiting on static wiring checks...");
    }
    await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
