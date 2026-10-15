/**
 * Regression guard for production journey blocker fixes (2026-10-15).
 *
 *   npx tsx scripts/test-production-journey-blocker-fixes.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function assertNoVoiceAppointmentUpdatedAt(rel: string) {
  const src = read(rel);
  if (!src.includes("voiceAppointment.findMany")) return;
  const blocks = src.split("voiceAppointment.findMany");
  for (let i = 1; i < blocks.length; i++) {
    const chunk = blocks[i]!.slice(0, 600);
    assert.equal(
      /updatedAt/.test(chunk),
      false,
      `${rel}: voiceAppointment.findMany must not use updatedAt (model has startsAt/createdAt only)`,
    );
  }
}

assertNoVoiceAppointmentUpdatedAt("src/lib/appointment-reminders/load-ar-reminder-workspace.ts");
assertNoVoiceAppointmentUpdatedAt("src/app/api/appointment-reminders/ai-rescheduler/operations/route.ts");
assertNoVoiceAppointmentUpdatedAt("src/app/api/appointments/reminders/workspace/route.ts");

const unified = read("src/lib/templates/unified-templates.ts");
assert.ok(!unified.includes("solutionKey"), "unified-templates must not query solutionKey");
assert.ok(!unified.includes('orderBy: { updatedAt: "desc" }'), "Template model has no updatedAt");
assert.ok(unified.includes("loadMissedCallTextConfig"), "MCTB unified row uses canonical MCTB config");

const contactsSelect = read("src/lib/reputation/contacts.ts");
for (const col of [
  "source",
  "last_contacted_at",
  "campaign_attempts",
  "latest_reply_at",
  "review_completion",
]) {
  assert.ok(contactsSelect.includes(col), `contacts list select must include ${col}`);
}

const migration = read(
  "prisma/migrations/20261015103000_reputation_contacts_engagement_columns/migration.sql",
);
for (const col of ["source", "last_contacted_at", "campaign_attempts", "latest_reply_at"]) {
  assert.ok(migration.includes(col), `migration must add ${col}`);
}

console.log("test-production-journey-blocker-fixes: ok");
