/**
 * Safe Brevo / transactional-email env diagnostic (no full secrets in output).
 *
 * Usage:
 *   npx tsx scripts/diagnose-brevo-env.ts
 *   npx tsx scripts/diagnose-brevo-env.ts --send-test you@example.com
 *
 * Run on production web container to mirror runtime:
 *   docker exec <web> sh -c 'cd /app && npx tsx scripts/diagnose-brevo-env.ts'
 */
const SEND_TEST = process.argv.includes("--send-test")
  ? process.argv[process.argv.indexOf("--send-test") + 1]?.trim()
  : null;

const RELATED_ENV_NAMES = [
  "BREVO_API_KEY",
  "BREVO_FROM_EMAIL",
  "BREVO_REPLY_EMAIL",
  "SENDINBLUE_API_KEY",
  "REVIEW_REQUEST_FROM_EMAIL",
  "REVIEW_REQUEST_FROM_NAME",
  "REVIEW_REQUEST_REPLY_DOMAIN",
  "MCTB_HANDOFF_EMAIL_TEST_CAPTURE",
];

type SecretShape = {
  name: string;
  present: boolean;
  length?: number;
  trimmedLength?: number;
  hasOuterWhitespace?: boolean;
  wrappedInAsciiQuotes?: boolean;
  hasNewlineOrTab?: boolean;
  innerWhitespaceCount?: number;
  prefix?: string;
  suffix?: string;
  looksLikeBrevoV3ApiKey?: boolean;
  looksLikeSmtpLoginPair?: boolean;
  looksLikeJwt?: boolean;
  firstCharCode?: number;
  lastCharCode?: number;
};

function describeEnvSecret(name: string, raw: string | undefined): SecretShape {
  if (raw === undefined || raw === "") {
    return { name, present: false };
  }
  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  const innerWhitespace = (unquoted.match(/\s/g) || []).length;

  return {
    name,
    present: true,
    length: raw.length,
    trimmedLength: trimmed.length,
    hasOuterWhitespace: raw.length !== trimmed.length,
    wrappedInAsciiQuotes:
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")),
    hasNewlineOrTab: /[\r\n\t]/.test(raw),
    innerWhitespaceCount: innerWhitespace,
    prefix: unquoted.slice(0, 10),
    suffix: unquoted.slice(-4),
    looksLikeBrevoV3ApiKey: unquoted.startsWith("xkeysib-"),
    looksLikeSmtpLoginPair: unquoted.includes(":") && !unquoted.startsWith("xkeysib-"),
    looksLikeJwt: unquoted.startsWith("eyJ"),
    firstCharCode: raw.charCodeAt(0),
    lastCharCode: raw.charCodeAt(raw.length - 1),
  };
}

function candidateApiKeys(): Array<{ label: string; key: string }> {
  const raw = process.env.BREVO_API_KEY;
  if (!raw) return [];
  const trimmed = raw.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  const out: Array<{ label: string; key: string }> = [
    { label: "BREVO_API_KEY.trim()", key: trimmed },
  ];
  if (unquoted !== trimmed) {
    out.push({ label: "BREVO_API_KEY unquoted", key: unquoted });
  }
  const sendinblue = process.env.SENDINBLUE_API_KEY?.trim();
  if (sendinblue && sendinblue !== trimmed) {
    out.push({ label: "SENDINBLUE_API_KEY.trim()", key: sendinblue });
  }
  return out;
}

const BREVO_API_HOSTS = [
  "https://api.brevo.com",
  "https://api.sendinblue.com",
];

async function probeAccount(
  apiKey: string,
  baseUrl: string,
): Promise<{ host: string; status: number; bodyPreview: string }> {
  const res = await fetch(`${baseUrl}/v3/account`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
    },
  });
  const text = await res.text();
  return { host: baseUrl, status: res.status, bodyPreview: text.slice(0, 400) };
}

async function probeSendEmail(
  apiKey: string,
  fromEmail: string,
  fromName: string,
  to: string,
): Promise<{ status: number; bodyPreview: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject: "Transovo Brevo diagnostic (safe test)",
      htmlContent: "<p>If you received this, Brevo SMTP API + sender are working.</p>",
      textContent: "If you received this, Brevo SMTP API + sender are working.",
    }),
  });
  const text = await res.text();
  return { status: res.status, bodyPreview: text.slice(0, 400) };
}

async function main() {
  const envShapes = RELATED_ENV_NAMES.map((n) =>
    describeEnvSecret(n, process.env[n]),
  );

  const fromEmail =
    process.env.REVIEW_REQUEST_FROM_EMAIL?.trim() ||
    process.env.BREVO_FROM_EMAIL?.trim() ||
    null;
  const fromName = process.env.REVIEW_REQUEST_FROM_NAME?.trim() || "Transovo";

  const keys = candidateApiKeys();
  const probes: Array<{
    keyLabel: string;
    accounts?: Array<{ host: string; status: number; bodyPreview: string }>;
    smtp?: { status: number; bodyPreview: string };
  }> = [];

  for (const { label, key } of keys) {
    const entry: (typeof probes)[number] = { keyLabel: label };
    entry.accounts = [];
    for (const host of BREVO_API_HOSTS) {
      try {
        entry.accounts.push(await probeAccount(key, host));
      } catch (e) {
        entry.accounts.push({
          host,
          status: 0,
          bodyPreview: e instanceof Error ? e.message : "fetch_failed",
        });
      }
    }
    if (fromEmail && SEND_TEST) {
      try {
        entry.smtp = await probeSendEmail(key, fromEmail, fromName, SEND_TEST);
      } catch (e) {
        entry.smtp = {
          status: 0,
          bodyPreview: e instanceof Error ? e.message : "fetch_failed",
        };
      }
    }
    probes.push(entry);
  }

  const runtimeMatchesBrevoTs = {
    headerName: "api-key",
    endpointAccount: "GET https://api.brevo.com/v3/account",
    endpointSmtp: "POST https://api.brevo.com/v3/smtp/email",
    codeUsesEnv: "BREVO_API_KEY.trim() only (not SENDINBLUE_API_KEY)",
    fromResolution:
      "REVIEW_REQUEST_FROM_EMAIL || BREVO_FROM_EMAIL (REVIEW_REQUEST_FROM_NAME or Transovo)",
  };

  const { createHash } = await import("crypto");
  const rawKey = process.env.BREVO_API_KEY ?? "";
  const keyFingerprint = rawKey
    ? createHash("sha256").update(rawKey).digest("hex").slice(0, 16)
    : null;

  console.log(
    JSON.stringify(
      {
        at: new Date().toISOString(),
        brevoApiKeySha256Prefix: keyFingerprint,
        runtimeMatchesBrevoTs,
        envShapes,
        fromEmailPresent: Boolean(fromEmail),
        fromEmailDomain: fromEmail?.includes("@") ? fromEmail.split("@")[1] : null,
        sendTestTo: SEND_TEST || null,
        apiKeyProbes: probes,
        interpretation: {
          account200: "API key valid for REST v3",
          account401KeyNotFound:
            "Brevo rejected api-key header value (wrong/revoked key, SMTP password, or malformed env value)",
          smtp201: "Transactional send accepted (check inbox)",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
