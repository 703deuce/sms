/**
 * Ensures Appointment Reminders SMS does not import Voice V3 *tool dispatch*
 * (live call runtime). Shared Microsoft Graph primitives are allowed via
 * src/lib/calendar/ar-microsoft-primitives.ts.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/lib/appointment-reminders");
const FORBIDDEN = [
  "dispatchRescheduleIfRequired",
  "dispatchAppointmentManagementIfRequired",
  "runRescheduleAppointment",
  "scheduling-workflows",
  "agent-tool-gateway",
  "VoiceV3CallContext",
  "appointment-management-dispatch",
];

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) files.push(p);
  }
  return files;
}

const violations: string[] = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, "utf8");
  for (const token of FORBIDDEN) {
    if (text.includes(token)) {
      violations.push(`${file}: forbidden ${token}`);
    }
  }
}

assert.equal(violations.length, 0, violations.join("\n"));

const primitives = readFileSync(
  join(process.cwd(), "src/lib/calendar/ar-microsoft-primitives.ts"),
  "utf8",
);
assert.ok(primitives.includes("executeMicrosoftUpdateBooking"));
assert.ok(primitives.includes("does NOT call Voice V3 tools"));

console.log("PASS verify-ar-sms-no-voice-tools");
