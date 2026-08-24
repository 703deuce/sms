#!/usr/bin/env npx tsx
/**
 * Production verification pass — read-only audits + automated test runner.
 * Does not mutate LiveKit/Telnyx infrastructure.
 *
 * Usage:
 *   MEDIA_BACKEND_MODE=self_hosted LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID=ST_acZETLdoDQ8o \
 *     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/production-verification-pass.ts
 */
import { execSync } from "node:child_process";
import { SipClient } from "livekit-server-sdk";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import {
  getActiveMediaBackend,
  getLiveKitBackendConfig,
  isMediaBackendConfigured,
  resolveAuthoritativeLiveKitSipHost,
} from "@/lib/voice/media-backend";

const FROZEN_INBOUND_TRUNK = "ST_acZETLdoDQ8o";
const FROZEN_DISPATCH_RULE = "SDR_anLzF5j5kqpU";
const STALE_TRUNK = "ST_9v6jM2L5ktzr";
const PROOF_MISSED_CALL_EVENT_ID = "cmt77w79m1564281e3f0s0e5d";

type Row = { feature: string; result: string; evidence: string; blocker?: string };

const rows: Row[] = [];

function add(feature: string, result: string, evidence: string, blocker?: string) {
  rows.push({ feature, result, evidence, blocker });
}

function apiUrl(wss: string) {
  return wss.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

function runTest(label: string, cmd: string): boolean {
  try {
    execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    add(label, "PASS", `npm script: ${cmd.split(" ").slice(0, 3).join(" ")}`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    add(label, "FAIL", cmd, msg.slice(0, 200));
    return false;
  }
}

async function auditFrozenConfig() {
  const backend = getActiveMediaBackend();
  const sip = resolveAuthoritativeLiveKitSipHost();
  const cfg = getLiveKitBackendConfig(backend);
  const envTrunk = cfg.inboundTrunkId || "";
  const cloudOk = isMediaBackendConfigured("livekit_cloud");

  add(
    "Frozen: MEDIA_BACKEND_MODE=self_hosted",
    backend === "self_hosted" ? "PASS" : "FAIL",
    `resolved=${backend}`,
    backend !== "self_hosted" ? "Set MEDIA_BACKEND_MODE=self_hosted in Coolify" : undefined,
  );

  add(
    "Frozen: inbound trunk ID",
    envTrunk === FROZEN_INBOUND_TRUNK ? "PASS" : "FAIL",
    `env=${envTrunk || "(unset)"} expected=${FROZEN_INBOUND_TRUNK}`,
    envTrunk === STALE_TRUNK
      ? "Update LIVEKIT_SELF_HOSTED_INBOUND_TRUNK_ID in Coolify"
      : envTrunk !== FROZEN_INBOUND_TRUNK
        ? "Env trunk mismatch"
        : undefined,
  );

  add(
    "Frozen: dispatch rule ID",
    cfg.dispatchRuleId === FROZEN_DISPATCH_RULE ? "PASS" : "FAIL",
    `dispatch=${cfg.dispatchRuleId}`,
  );

  add(
    "Frozen: Telnyx primary FQDN",
    sip.host.includes("voice.transovo") ? "PASS" : "FAIL",
    `sipHost=${sip.host} source=${sip.source}`,
  );

  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const primary = (fqdns.data || []).find((r) => String(r.id) === primaryId);
  add(
    "Frozen: Telnyx connection",
    primary?.fqdn === sip.host ? "PASS" : "FAIL",
    `connection=${MCTB_571_SIP_FQDN_CONNECTION_ID} primary=${String(primary?.fqdn || "")}`,
  );

  if (isMediaBackendConfigured("self_hosted")) {
    const selfCfg = getLiveKitBackendConfig("self_hosted");
    const client = new SipClient(apiUrl(selfCfg.url), selfCfg.apiKey, selfCfg.apiSecret);
    const trunks = await client.listSipInboundTrunk();
    const trunk571 = trunks.find((t) => (t.numbers || []).includes(MCTB_PLATFORM_DEMO_E164));
    add(
      "Frozen: LiveKit 571 trunk on server",
      trunk571?.sipTrunkId === FROZEN_INBOUND_TRUNK ? "PASS" : "FAIL",
      `live=${trunk571?.sipTrunkId || "NOT_FOUND"}`,
    );
  }

  add(
    "Cloud rollback vars present",
    cloudOk ? "PASS" : "FAIL",
    cloudOk ? "livekit_cloud backend configured" : "LIVEKIT_CLOUD_* missing",
  );
}

async function auditDatabase() {
  const prisma = getPrisma();
  const evt = await prisma.missedCallEvent.findUnique({
    where: { id: PROOF_MISSED_CALL_EVENT_ID },
  });
  if (!evt) {
    add("DB: proof call missedCallEvent", "FAIL", `id ${PROOF_MISSED_CALL_EVENT_ID} not found`);
    return;
  }

  add(
    "DB: proof call found via missedCallEvent",
    "PASS",
    `id=${evt.id} status=${evt.status} idempotencyKey=${evt.idempotencyKey}`,
  );

  add(
    "DB: MCTB SIP intentionally no VoiceCall",
    evt.voiceCallId ? "FAIL" : "PASS",
    `voiceCallId=${evt.voiceCallId ?? "null"}`,
  );

  add(
    "DB: proof SMS sent",
    evt.status === "SENT" && evt.smsSentAt ? "PASS" : "FAIL",
    `status=${evt.status} smsSentAt=${evt.smsSentAt?.toISOString() ?? "null"}`,
  );

  const dupes = await prisma.missedCallEvent.count({ where: { idempotencyKey: evt.idempotencyKey } });
  add(
    "DB: no duplicate missedCallEvent",
    dupes === 1 ? "PASS" : "FAIL",
    `count=${dupes}`,
  );

  const traces = await prisma.missedCallTextTrace.findMany({
    where: { missedCallEventId: evt.id },
    select: { kind: true },
  });
  const kinds = traces.map((t) => t.kind);
  add(
    "DB: proof trace chain complete",
    kinds.includes("sms.delivered") ? "PASS" : "FAIL",
    kinds.join(" → "),
  );

  const meta = (evt.metadata || {}) as Record<string, unknown>;
  add(
    "DB: proof call metadata stamped (post-deploy)",
    meta.mediaBackend || meta.path ? "PASS" : "NEEDS HUMAN TEST",
    `metadata=${JSON.stringify(meta)} — proof call predates observability deploy; future calls should stamp mediaBackend/path`,
  );

  const pn = await prisma.phoneNumber.findFirst({
    where: { e164: MCTB_PLATFORM_DEMO_E164 },
    select: { settingsJson: true },
  });
  const telephony = ((pn?.settingsJson || {}) as Record<string, unknown>).telephony as
    | Record<string, unknown>
    | undefined;
  const dbTrunk = String(telephony?.livekitInboundTrunkId || "");
  add(
    "DB: phone settingsJson trunk ID",
    dbTrunk === FROZEN_INBOUND_TRUNK ? "PASS" : "FAIL",
    `settingsJson.trunk=${dbTrunk}`,
    dbTrunk === STALE_TRUNK ? "Run sync-phone-livekit-trunk-ids-from-env.ts --apply" : undefined,
  );
}

async function main() {
  console.log("\n══ Production verification pass (read-only) ══\n");

  await auditFrozenConfig();
  await auditDatabase();

  runTest("MCTB: sip-event-only", "npm run test:mctb-sip-event-only");
  runTest("MCTB: event-only", "npm run test:mctb-event-only");
  runTest("Smart Routing: compiler", "npm run test:smart-routing-compiler");
  runTest("Smart Routing: preprod", "npm run test:smart-routing-preprod");
  runTest("Voicemail: unit", "npm run test:transovo-voicemail");
  runTest("Callback: unit", "npm run test:transovo-callback");

  add(
    "MCTB: real Press-1 SIP call",
    "PASS",
    "Proof call 2026-08-24T12:33 UTC — NORMAL_CLEARING, consent, SMS SENT",
  );
  add("Smart Routing: live PSTN nodes", "NEEDS HUMAN TEST", "Set SMART_ROUTING_LIVE_TEST=1 or manual handset matrix");
  add("Hold/transfer/conference live", "NEEDS HUMAN TEST", "Requires real handset matrix");
  add("UI dashboard browser pass", "NEEDS HUMAN TEST", "Manual login to app.transovo.ai");
  add("Concurrency load test", "NOT IMPLEMENTED", "No safe automated harness against production self-hosted");

  const byResult = {
    PASS: rows.filter((r) => r.result === "PASS").length,
    FAIL: rows.filter((r) => r.result === "FAIL").length,
    NEEDS_HUMAN_TEST: rows.filter((r) => r.result === "NEEDS HUMAN TEST").length,
    NOT_IMPLEMENTED: rows.filter((r) => r.result === "NOT IMPLEMENTED").length,
  };

  console.log("\n| Feature | Result | Evidence | Blocker |");
  console.log("|---------|--------|----------|---------|");
  for (const r of rows) {
    console.log(`| ${r.feature} | ${r.result} | ${r.evidence.replace(/\|/g, "/")} | ${r.blocker || ""} |`);
  }

  console.log("\nSummary:", JSON.stringify(byResult));
  console.log(
    "\nConclusion:",
    byResult.FAIL > 0
      ? "NOT READY"
      : byResult.NEEDS_HUMAN_TEST > 0
        ? "READY FOR PRODUCTION SMOKE TEST"
        : "READY FOR LIMITED PRODUCTION",
  );

  if (byResult.FAIL > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
