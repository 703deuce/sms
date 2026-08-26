/**
 * Controlled live Telnyx SMS smoke for Mass Texting.
 *
 * Sender and recipients come from MASS_TEXT_LIVE_FROM / MASS_TEXT_LIVE_TO
 * (comma-separated E.164). Never send to numbers outside that allowlist.
 *
 * Run: npm run test:mass-texting-live-sms
 */
import { writeFileSync } from "node:fs";
import { MASS_TEXT_MMS_PRODUCTION_ENABLED } from "../src/lib/mass-texting/pricing";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "../src/lib/messaging/telnyx/config";
import { estimateSmsSegments } from "../src/lib/utils";

type TelnyxMessage = {
  id: string;
  to?: Array<{ phone_number?: string; status?: string }>;
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+") && digits.length >= 12) return digits;
  const just = raw.replace(/\D/g, "");
  if (just.length === 10) return `+1${just}`;
  if (just.length === 11 && just.startsWith("1")) return `+${just}`;
  throw new Error(`Invalid E.164 phone: ${raw}`);
}

function loadAllowlist(): { from: string; to: string[] } {
  const from = toE164(process.env.MASS_TEXT_LIVE_FROM || "");
  const to = String(process.env.MASS_TEXT_LIVE_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(toE164);
  if (!to.length) {
    throw new Error("MASS_TEXT_LIVE_TO is required (comma-separated E.164)");
  }
  return { from, to };
}

async function sendSms(from: string, to: string, text: string) {
  if (from === to) throw new Error("from and to must differ");
  const res = await telnyxRequest<{ data: TelnyxMessage }>("/messages", {
    method: "POST",
    body: { from, to, text, type: "SMS" },
    noRetry: true,
  });
  return res.data;
}

async function getMessage(id: string) {
  const res = await telnyxRequest<{ data: TelnyxMessage }>(`/messages/${encodeURIComponent(id)}`);
  return res.data;
}

async function pollUntilTerminal(id: string, attempts = 10) {
  let last: TelnyxMessage | null = null;
  for (let i = 0; i < attempts; i += 1) {
    last = await getMessage(id);
    const status = last.to?.[0]?.status || "";
    if (["delivered", "delivery_failed", "failed"].includes(status)) return last;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return last;
}

async function main() {
  if (!getTelnyxApiKey()) {
    console.log("BLOCKED_BY_EXTERNAL_DEPENDENCY: TELNYX_API_KEY missing");
    process.exit(2);
  }

  const { from, to } = loadAllowlist();
  const shortBody = "Transovo Mass Texting cert smoke. Reply HELP for help, STOP to opt out.";
  const longBody = `${"Cert multi-segment. ".repeat(20)} Reply STOP to opt out.`;
  const longSegments = estimateSmsSegments(longBody).segments;
  const results: Array<Record<string, unknown>> = [];

  for (const dest of to) {
    const short = await sendSms(from, dest, shortBody);
    const polled = await pollUntilTerminal(short.id);
    const row = {
      kind: "short",
      to: dest,
      from,
      id: short.id,
      status: polled?.to?.[0]?.status || short.to?.[0]?.status || "unknown",
      errors: polled?.errors || short.errors || [],
    };
    results.push(row);
    console.log("live_sms", row);
  }

  const long = await sendSms(from, to[0], longBody);
  const longPolled = await pollUntilTerminal(long.id);
  const longRow = {
    kind: "long",
    to: to[0],
    from,
    id: long.id,
    status: longPolled?.to?.[0]?.status || long.to?.[0]?.status || "unknown",
    segments: longSegments,
    errors: longPolled?.errors || long.errors || [],
  };
  results.push(longRow);
  console.log("live_long_sms", longRow);

  const delivered = results.filter((r) => r.status === "delivered").length;
  const failed = results.filter((r) =>
    ["delivery_failed", "failed"].includes(String(r.status)),
  ).length;
  const report = {
    ok: failed === 0 && delivered > 0,
    from,
    recipientCount: to.length,
    mms: MASS_TEXT_MMS_PRODUCTION_ENABLED ? "enabled" : "hidden",
    delivered,
    failed,
    results,
  };
  try {
    writeFileSync("/opt/cursor/artifacts/live_telnyx_sms_smoke.json", JSON.stringify(report, null, 2));
  } catch {
    // optional
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(2);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (/403|401|permission|campaign|10dlc|a2p|not authorized|BLOCKED_BY_EXTERNAL/i.test(message)) {
    console.log(`BLOCKED_BY_EXTERNAL_DEPENDENCY: ${message}`);
    process.exit(2);
  }
  console.error(err);
  process.exit(1);
});
