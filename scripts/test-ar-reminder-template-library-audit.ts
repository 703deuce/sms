/**
 * Static audit: reminder template library wording vs message type + brace normalization.
 * Run: npx tsx scripts/test-ar-reminder-template-library-audit.ts
 */
import catalog from "../src/lib/appointment-reminders/template-library/transovo-reminder-templates.json";
import type { TemplateLibraryCatalog } from "../src/lib/appointment-reminders/template-library/types";
import { normalizeLibraryBraces } from "../src/lib/appointment-reminders/template-library/validate-template";

const lib = catalog as TemplateLibraryCatalog;

const FORBIDDEN_BY_TYPE: Record<string, RegExp[]> = {
  booking_confirmation: [/updated your appointment/i, /rescheduled/i],
  reschedule_notice: [/is booked for/i],
};

let failures = 0;

for (const entry of lib.templates) {
  const body = normalizeLibraryBraces(entry.body);
  if (body.includes("{") && !body.includes("{{")) {
    console.error(`FAIL ${entry.id}: body uses single-brace variables after normalize`);
    failures++;
  }
  const forbidden = FORBIDDEN_BY_TYPE[entry.messageType] || [];
  for (const re of forbidden) {
    if (re.test(body)) {
      console.error(`FAIL ${entry.id}: messageType=${entry.messageType} matches forbidden ${re}`);
      failures++;
    }
  }
  if (!body.includes("STOP") && entry.channel === "sms") {
    console.error(`FAIL ${entry.id}: SMS template missing STOP opt-out wording`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} template audit failure(s)`);
  process.exit(1);
}

console.log(`PASS: audited ${lib.templates.length} library templates`);
