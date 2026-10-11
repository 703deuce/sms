/**
 * Appointment Reminders — Overview customer conversations (list + thread loaders).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-overview-conversations.ts
 */
import assert from "node:assert/strict";
import { AR_PLAN_CATALOG } from "../src/lib/appointment-reminders/commercial/ar-plan-catalog";
async function main() {
  assert.equal(AR_PLAN_CATALOG.free.smsConfirmationsAndResponses, false);
  assert.equal(AR_PLAN_CATALOG.starter.smsConfirmationsAndResponses, true);
  assert.equal(AR_PLAN_CATALOG.free.reminderStepsMax, 1);
  assert.equal(AR_PLAN_CATALOG.starter.reminderStepsMax, 3);

  const { exampleReminderMergeVars } = await import(
    "../src/lib/appointment-reminders/template-library/preview-vars"
  );
  const vars = exampleReminderMergeVars({
    businessName: "Acme Spa",
    timezone: "America/New_York",
    customMergeFields: { first_name: "Jordan" },
  });
  assert.equal(vars.first_name, "Jordan");
  assert.equal(vars.business_name, "Acme Spa");

  console.log("test-ar-overview-conversations: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
