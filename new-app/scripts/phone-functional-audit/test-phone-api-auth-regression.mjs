#!/usr/bin/env node
/**
 * Production Phone API must not allow anonymous cross-site reads/mutations.
 * Fails until middleware + assertPhoneApiAccess ship (NODE_ENV=production).
 *
 *   PHONE_TEST_BASE_URL=https://transovo.ai node scripts/phone-functional-audit/test-phone-api-auth-regression.mjs
 */
const base = (process.env.PHONE_TEST_BASE_URL || "https://transovo.ai").replace(/\/$/, "");

async function probe(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "cross-site",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

async function main() {
  const getStatus = await probe("GET", "/api/phone/settings");
  const patchStatus = await probe("PATCH", "/api/phone/settings", { recordCalls: true });

  const secure = getStatus === 401 && patchStatus === 401;
  if (secure) {
    console.log("PASS phone-api-auth-regression: anonymous cross-site GET/PATCH blocked");
    process.exit(0);
  }

  console.error("FAIL phone-api-auth-regression: production allows anonymous Phone API access");
  console.error(`  GET /api/phone/settings → HTTP ${getStatus} (expected 401)`);
  console.error(`  PATCH /api/phone/settings → HTTP ${patchStatus} (expected 401)`);
  console.error(
    "  Cause (pre-fix): resolveWorkspaceId() pins first tenant; GET/PATCH had no auth guard.",
  );
  process.exit(1);
}

main();
