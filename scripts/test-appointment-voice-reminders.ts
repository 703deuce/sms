/**
 * Hermetic checks for appointment voice reminders wiring.
 * Run: npx tsx scripts/test-appointment-voice-reminders.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const failures: string[] = [];

function assert(name: string, ok: boolean) {
  if (!ok) failures.push(name);
}

const handlers = read("src/lib/jobs/job-handlers.ts");
assert("job handler appointment_voice_reminder_retry", handlers.includes("appointment_voice_reminder_retry"));

const engine = read("src/lib/appointment-workflows/engine.ts");
assert("workflow make_voice_call action", engine.includes('case "make_voice_call"'));

const webhook = read("src/lib/voice/telnyx/webhook-handlers.ts");
assert("webhook appointment voice reminder", webhook.includes("processAppointmentVoiceReminderWebhook"));

const types = read("src/lib/appointment-workflows/types.ts");
assert("workflow type make_voice_call", types.includes('"make_voice_call"'));

const nav = read("src/lib/products/appointments-nav.ts");
assert("nav voice reminders", nav.includes("/appointments/voice-reminders"));

if (failures.length) {
  console.error("FAIL", failures);
  process.exit(1);
}

console.log("OK appointment voice reminders wiring");
