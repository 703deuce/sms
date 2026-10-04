/**
 * Standalone Brevo API probe — classifies 401/403 responses (key vs IP vs other).
 *
 * Do NOT commit real keys. Pass via env:
 *   BREVO_TEST_API_KEY='xkeysib-...' npx tsx scripts/test-brevo-api-key-probe.ts
 *
 * Optional:
 *   BREVO_PROBE_FROM_EMAIL=noreply@transovo.ai
 *   BREVO_PROBE_TO=you@example.com   # if set, also POST /v3/smtp/email
 */
const API_KEY = process.env.BREVO_TEST_API_KEY?.trim() || "";
const FROM =
  process.env.BREVO_PROBE_FROM_EMAIL?.trim() ||
  process.env.REVIEW_REQUEST_FROM_EMAIL?.trim() ||
  "noreply@transovo.ai";
const SEND_TO = process.env.BREVO_PROBE_TO?.trim() || null;

const HOSTS = ["https://api.brevo.com", "https://api.sendinblue.com"];

function classify(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 401 && lower.includes("key not found")) return "invalid_or_unknown_api_key";
  if (status === 403 || lower.includes("ip") || lower.includes("not authorized")) {
    return "likely_ip_or_permission_block";
  }
  if (status === 200 || status === 201 || status === 202) return "ok";
  return "other";
}

async function probeGet(base: string, path: string, apiKey: string) {
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { accept: "application/json", "api-key": apiKey },
  });
  const text = await res.text();
  return {
    path,
    status: res.status,
    classification: classify(res.status, text),
    body: text.slice(0, 500),
  };
}

async function probePostSmtp(base: string, apiKey: string) {
  if (!SEND_TO) return null;
  const res = await fetch(`${base}/v3/smtp/email`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: FROM, name: "Transovo probe" },
      to: [{ email: SEND_TO }],
      subject: "Brevo API key probe (ignore)",
      textContent: "Automated probe from test-brevo-api-key-probe.ts",
    }),
  });
  const text = await res.text();
  return {
    path: "/v3/smtp/email",
    status: res.status,
    classification: classify(res.status, text),
    body: text.slice(0, 500),
  };
}

async function main() {
  if (!API_KEY) {
    console.error(
      "Set BREVO_TEST_API_KEY (do not commit real keys to the repo).",
    );
    process.exit(1);
  }

  let egressIp: string | null = null;
  try {
    const ipRes = await fetch("https://api.ipify.org", {
      signal: AbortSignal.timeout(8000),
    });
    egressIp = (await ipRes.text()).trim();
  } catch {
    egressIp = null;
  }

  const keyMeta = {
    length: API_KEY.length,
    prefix: API_KEY.slice(0, 10),
    suffix: API_KEY.slice(-8),
    lastTwoCharCodes: [API_KEY.charCodeAt(API_KEY.length - 2), API_KEY.charCodeAt(API_KEY.length - 1)],
  };

  const results: Record<string, unknown> = {
    at: new Date().toISOString(),
    egressIp,
    keyMeta,
    fromEmail: FROM,
    sendTo: SEND_TO,
    probes: [] as unknown[],
  };

  for (const base of HOSTS) {
    const row: Record<string, unknown> = { host: base };
    row.account = await probeGet(base, "/v3/account", API_KEY);
    row.senders = await probeGet(base, "/v3/senders", API_KEY);
    const smtp = await probePostSmtp(base, API_KEY);
    if (smtp) row.smtp = smtp;
    (results.probes as unknown[]).push(row);
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
