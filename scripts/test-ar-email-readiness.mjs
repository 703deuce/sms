/**
 * Verifies AR email readiness uses the same env vars as lib/email/brevo.ts
 * Usage: node scripts/test-ar-email-readiness.mjs
 */
import assert from "node:assert/strict";

const cases = [
  {
    env: {},
    ready: false,
    includes: "not configured",
  },
  {
    env: { BREVO_API_KEY: "test-key" },
    ready: false,
    includes: "sender address",
  },
  {
    env: { BREVO_API_KEY: "test-key", BREVO_FROM_EMAIL: "reminders@example.com" },
    ready: true,
  },
  {
    env: { BREVO_API_KEY: "test-key", REVIEW_REQUEST_FROM_EMAIL: "noreply@example.com" },
    ready: true,
  },
];

for (const c of cases) {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("BREVO_") || k.startsWith("REVIEW_REQUEST_") || k.startsWith("TRANSOVO_TRANSACTIONAL_")) {
      delete process.env[k];
    }
  }
  Object.assign(process.env, c.env);

  const { resolveTransactionalEmailSenderConfig } = await import("../src/lib/email/brevo.ts");
  const cfg = resolveTransactionalEmailSenderConfig();
  assert.equal(cfg.productionReady, c.ready, JSON.stringify(c.env));

  const { evaluateArEmailSenderReadiness } = await import(
    "../src/lib/appointment-reminders/ar-email-readiness.ts"
  );
  const ar = await evaluateArEmailSenderReadiness("ws_test");
  assert.equal(ar.ready, c.ready, JSON.stringify(c.env));
  if (c.includes) {
    assert.ok(ar.detail.toLowerCase().includes(c.includes), ar.detail);
  }
  assert.ok(!ar.detail.includes("BREVO_"), ar.detail);
}

console.log("test-ar-email-readiness: PASS");
