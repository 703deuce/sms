#!/usr/bin/env node
/**
 * Service-booking UA smoke — package purchase → book → redeem → reload.
 * Requires DEV_AUTH_BYPASS or seeded workspace with Stripe Connect in test mode.
 *
 * Usage:
 *   node scripts/cert-service-booking-ua-smoke.mjs
 */
import { execSync } from "node:child_process";

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
  ];

  for (const check of checks) {
    const res = await fetch(check.url, { redirect: "manual" });
    if (res.status >= 500) fail(`${check.name} returned ${res.status}`);
    console.log(`OK  ${check.name} (${res.status})`);
  }

  console.log("\nNOTE: Full UA certification (purchase → balance → book → reload) requires seeded workspace + Stripe test mode.");
  console.log("PASS criteria: customer journey works after hard refresh, not merely API 200.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
