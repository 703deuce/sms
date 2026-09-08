#!/usr/bin/env node
/**
 * Service-booking UA smoke — routes + entitlement API certification.
 *
 * Usage:
 *   node scripts/cert-service-booking-ua-smoke.mjs
 */
const base = process.env.UI_AGENT_BASE_URL || process.env.APP_URL || "http://localhost:3000";

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`Service-booking UA smoke against ${base}`);
  const checks = [
    { name: "public store route", url: `${base}/book/demo/store` },
    { name: "manage appointment route shape", url: `${base}/manage/invalid-token` },
    { name: "client portal route shape", url: `${base}/portal/invalid-token` },
    { name: "booking web manifest", url: `${base}/booking.webmanifest` },
    { name: "booking service worker", url: `${base}/sw-booking.js` },
  ];

  for (const check of checks) {
    const res = await fetch(check.url, { redirect: "manual" });
    if (res.status >= 500) fail(`${check.name} returned ${res.status}`);
    console.log(`OK  ${check.name} (${res.status})`);
  }

  console.log("\nRunning entitlement API certification…");
  const { execSync } = await import("node:child_process");
  try {
    execSync("npx tsx scripts/cert-service-booking-entitlements.ts", {
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    fail("entitlement API certification failed");
  }

  console.log("\nPASS service-booking UA smoke (routes + entitlement API)");
  console.log("NOTE: Full browser PASS still requires Stripe test checkout + hard refresh verification.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
