/**
 * Replay MCTB TeXML inbound webhook (no physical call).
 *
 * POSTs the same form-urlencoded payload Telnyx sends to:
 *   /api/telnyx/voice/mctb-consent
 *
 * Usage:
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts --url http://localhost:3000
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts --url https://app.transovo.com --event gather --digits 1
 *
 * Env:
 *   APP_URL / NEXT_PUBLIC_APP_URL — default base when --url omitted
 */
import assert from "node:assert/strict";

const DEFAULT_CALL = {
  From: process.env.MCTB_TEST_FROM || "+17038166017", // pragma: allowlist secret
  To: process.env.MCTB_TEST_TO || "+15714073615",
  ForwardedFrom: process.env.MCTB_TEST_FORWARDED_FROM || "+15714776175", // pragma: allowlist secret
  CallStatus: "in-progress",
  CallSid: "v3:replay-att-forward-001",
} as const;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function baseUrl(): string {
  const explicit = argValue("--url");
  if (explicit) return explicit.replace(/\/$/, "");
  const env =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    "http://localhost:3000";
  return env.replace(/\/$/, "");
}

function buildFormFields(): Record<string, string> {
  return {
    From: argValue("--from") || DEFAULT_CALL.From,
    To: argValue("--to") || DEFAULT_CALL.To,
    ForwardedFrom: argValue("--forwarded-from") || DEFAULT_CALL.ForwardedFrom,
    CallStatus: argValue("--call-status") || DEFAULT_CALL.CallStatus,
    CallSid: argValue("--call-sid") || DEFAULT_CALL.CallSid,
    ...(argValue("--digits") ? { Digits: argValue("--digits")! } : {}),
  };
}

async function main() {
  const event = argValue("--event") || "inbound";
  const base = baseUrl();
  const url = new URL(`${base}/api/telnyx/voice/mctb-consent`);
  if (event !== "inbound") url.searchParams.set("event", event);
  const forwardedFrom = argValue("--forwarded-from") || DEFAULT_CALL.ForwardedFrom;
  if (event === "gather" && forwardedFrom) {
    url.searchParams.set("forwardedFrom", forwardedFrom);
  }

  const fields = buildFormFields();
  const body = new URLSearchParams(fields).toString();

  console.log("MCTB TeXML webhook replay\n");
  console.log(`POST ${url.toString()}`);
  console.log("Body:", fields);
  console.log();

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(text.slice(0, 800) + (text.length > 800 ? "\n…" : ""));

  assert.equal(res.status, 200, `expected HTTP 200, got ${res.status}`);
  assert.match(text, /^<\?xml|<Response>/, "response should be TeXML");

  if (event === "inbound" || !argValue("--digits")) {
    assert.match(text, /<Gather/i, "inbound should return Press-1 Gather TeXML");
    assert.match(text, /press 1/i, "inbound prompt should mention press 1");
  }

  if (event === "gather" && argValue("--digits") === "1") {
    assert.match(text, /Perfect/i, "gather+1 should confirm SMS sent");
  }

  console.log("\n✓ Replay OK — TeXML response looks valid");
  console.log(
    "\nTip: run DB regression separately (no server needed):",
  );
  console.log(
    "  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-call-event.ts",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
