/**
 * Replay + validate MCTB TeXML inbound webhook (no physical call).
 *
 * POSTs the Telnyx form payload to /api/telnyx/voice/mctb-consent and validates:
 * - HTTP 200 + text/xml
 * - Well-formed XML + <Response>
 * - <Gather> / <Say> / <Play> structure
 * - Gather action URL is public HTTPS
 * - Optional HEAD on <Play> MP3 URLs
 *
 * Usage:
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts --url http://localhost:3000
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts --validate-only
 *   npx tsx scripts/replay-mctb-consent-texml-call.ts --event gather --digits 1
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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
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

function extractTag(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1] || "");
  return out;
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, "i");
  const m = xml.match(re);
  return m?.[1] ?? null;
}

function validateXmlSyntax(xml: string) {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/, "XML prolog missing");
  assert.match(xml, /<Response>[\s\S]*<\/Response>/, "<Response> wrapper missing");
  assert.doesNotMatch(xml, /\[object Object\]|undefined<\/Play>/, "malformed interpolated values");
  if (xml.includes("<Gather")) {
    assert.match(xml, /<\/Gather>/, "Gather not closed");
  }
  if (xml.includes("<Say") && !xml.includes("<Say/>")) {
    assert.match(xml, /<\/Say>/, "Say not closed");
  }
}

async function headReachable(url: string): Promise<{ ok: boolean; status: number | null; detail: string }> {
  if (!url.startsWith("https://")) {
    return { ok: false, status: null, detail: "not public HTTPS" };
  }
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)) {
    return { ok: false, status: null, detail: "localhost/private host" };
  }
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const ct = res.headers.get("content-type") || "";
    const ok = res.ok && (ct.includes("audio") || ct.includes("mpeg") || ct.includes("octet-stream"));
    return {
      ok,
      status: res.status,
      detail: ok ? "reachable" : `HTTP ${res.status} content-type=${ct || "(none)"}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function validateResponse(res: Response, text: string, event: string, digits?: string) {
  console.log("── Response headers ──");
  for (const [k, v] of res.headers.entries()) {
    console.log(`${k}: ${v}`);
  }
  console.log();
  console.log("── Response body ──");
  console.log(text);
  console.log();

  assert.equal(res.status, 200, `expected HTTP 200, got ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  assert.match(ct, /text\/xml/i, `expected text/xml content-type, got ${ct}`);
  validateXmlSyntax(text);

  const gatherAction = extractAttr(text, "Gather", "action");
  const playUrls = extractTag(text, "Play");
  const says = extractTag(text, "Say");
  const hasGather = /<Gather/i.test(text);

  console.log("── Parsed TeXML ──");
  console.log(`gather=${hasGather} action=${gatherAction ?? "(none)"}`);
  console.log(`sayCount=${says.length} playCount=${playUrls.length}`);
  if (playUrls.length) console.log(`playUrls=${JSON.stringify(playUrls)}`);
  console.log();

  if (event === "inbound" && !digits) {
    if (hasGather) {
      assert.ok(gatherAction, "Gather missing action URL");
      assert.match(gatherAction, /^https:\/\//i, "Gather action must be public HTTPS");
      assert.doesNotMatch(gatherAction, /localhost|127\.0\.0\.1/i, "Gather action must not be localhost");
      assert.match(gatherAction, /event=gather/, "Gather action must include event=gather");
    } else {
      assert.ok(says.length > 0, "inbound should include <Say> (say-only diagnostic) or <Gather>");
    }
    for (const playUrl of playUrls) {
      assert.notEqual(playUrl, "undefined", "Play URL must not be undefined");
      const probe = await headReachable(playUrl);
      console.log(`Play URL probe: ${playUrl} → ${probe.detail}`);
      assert.ok(probe.ok, `Play URL not reachable: ${playUrl} (${probe.detail})`);
    }
  }

  if (event === "gather" && digits === "1") {
    assert.match(text, /Perfect/i, "gather+1 should confirm SMS sent");
  }
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
  const prompt = argValue("--prompt");
  if (prompt) url.searchParams.set("prompt", prompt);

  const fields = buildFormFields();
  const body = new URLSearchParams(fields).toString();

  console.log("MCTB TeXML webhook replay + validate\n");
  console.log(`POST ${url.toString()}`);
  console.log("Body:", fields);
  console.log();

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await res.text();
  await validateResponse(res, text, event, argValue("--digits"));

  console.log("✓ Replay OK — TeXML response valid");
  console.log(
    "\nLook for server log: [mctb-consent-texml] response_ready after inbound_prompt.",
  );
  console.log(
    "If inbound_prompt appears in prod logs but response_ready does not, the handler died building XML.",
  );
}

main().catch((err) => {
  console.error("\n✗ Replay validation failed");
  console.error(err);
  process.exit(1);
});
