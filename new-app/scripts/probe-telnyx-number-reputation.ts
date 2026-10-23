/**
 * Read-only probe: Telnyx Number Reputation API availability for current credentials.
 * Does not purchase or enable paid features.
 *
 * Run: cd new-app && npx tsx scripts/probe-telnyx-number-reputation.ts
 */
const key = process.env.TELNYX_API_KEY?.trim();
if (!key) {
  console.log(
    JSON.stringify({
      provisioned: false,
      reason: "TELNYX_API_KEY not set",
      documentedNote:
        "Telnyx Number Reputation is a paid add-on (~$100/mo per business per public docs); enable via Telnyx portal before API returns scores.",
    }),
  );
  process.exit(0);
}

async function probe(path: string) {
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { path, status: res.status, body };
}

async function main() {
  const candidates = [
    "/number_reputation",
    "/phone_number_reputation",
    "/phone_numbers/reputation",
  ];
  const results = [];
  for (const path of candidates) {
    results.push(await probe(path));
  }
  const anyOk = results.some((r) => r.status >= 200 && r.status < 300);
  console.log(
    JSON.stringify(
      {
        provisioned: anyOk,
        probes: results,
        documentedNote:
          "If all probes return 404/403, reputation API is not enabled on this account. Transovo must not display spam scores without a successful API response.",
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
