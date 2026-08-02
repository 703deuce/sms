/**
 * Live: diagnose/repair Telnyx inbound routing for a DID via production.
 * Usage: node scripts/voice-inbound-repair.mjs [+18663464256]
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const E164 = (process.argv[2] || process.env.PHONE_E164 || "+18663464256").trim();
const REPAIR = !["0", "false", "diagnose"].includes(
  String(process.env.REPAIR || "true").toLowerCase(),
);

async function main() {
  const res = await fetch(`${BASE}/api/numbers/telnyx-inbound-repair`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({
      e164: E164,
      repair: REPAIR,
      workspaceId: "ws_1",
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
  if (!res.ok || json.data?.ready === false) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
