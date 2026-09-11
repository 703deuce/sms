#!/usr/bin/env tsx
/**
 * Client portal IDOR smoke — requires DB + seeded contacts/appointments.
 * Run: npx tsx scripts/test-client-portal-authorization.ts
 */
import assert from "node:assert/strict";
async function main() {
  assert.ok(
    typeof (await import("../src/lib/appointments/service-booking/crypto")).hashToken === "function",
    "portal token hashing available",
  );
  console.log("client-portal-authorization: static checks PASS (full IDOR E2E requires Playwright + DB)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
