/**
 * Live: diagnose/repair Telnyx inbound routing for a DID via production.
 * Usage: node scripts/voice-inbound-repair.mjs [+18663464256]
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim();
const E164 = (process.argv[2] || process.env.PHONE_E164 || "+18663464256").trim();
const REPAIR = !["0", "false", "diagnose"].includes(
  String(process.env.REPAIR || "true").toLowerCase(),
);

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(jar, res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function main() {
  const jar = new Map();
  const loginRes = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: OWNER_EMAIL }),
  });
  storeCookies(jar, loginRes);
  if (!loginRes.ok) {
    console.error("smoke-login failed", await loginRes.text());
    process.exit(1);
  }

  // Prefer dedicated repair route; fall back to sync-telnyx repairInbound.
  let res = await fetch(`${BASE}/api/numbers/telnyx-inbound-repair`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ e164: E164, repair: REPAIR }),
  });
  let text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 800) };
  }

  if (res.status === 404 || res.status === 405 || res.status === 401) {
    res = await fetch(`${BASE}/api/numbers/sync-telnyx`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(jar),
      },
      body: JSON.stringify({
        e164s: [E164],
        attachConnection: true,
        repairInbound: true,
      }),
    });
    text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 800) };
    }
  }

  console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
  const ready = json.data?.ready ?? json.data?.inbound?.ready;
  if (!res.ok || ready === false) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
