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

const schema = read("prisma/schema.prisma");
assert.ok(
  schema.includes("updatedAt   DateTime   @updatedAt") && schema.includes("model VoiceAppointment"),
  "VoiceAppointment must have updatedAt after schema fix",
);
assert.ok(
  read("prisma/migrations/20261015114500_voice_appointments_updated_at/migration.sql").includes(
    '"updatedAt"',
  ),
  "voice_appointments updatedAt migration must exist",
);

const opsRoute = read("src/app/api/appointment-reminders/ai-rescheduler/operations/route.ts");
assert.ok(opsRoute.includes("buildAiReschedulerOperationsWhere"));
assert.equal(/startsAt:\s*\{\s*gte:/.test(opsRoute), false);

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
