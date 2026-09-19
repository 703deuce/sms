/**
 * Static guard: appointment-management Graph helpers must be re-exported from
 * @/lib/voice/calendar/providers (runtime imports pull server-only).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const barrelPath = path.join(
  process.cwd(),
  "src/lib/voice/calendar/providers.ts",
);
const source = fs.readFileSync(barrelPath, "utf8");

const required = [
  "listMicrosoftCalendarEventsForAppointmentDiscovery",
  "updateMicrosoftEvent",
  "deleteMicrosoftEvent",
  "insertMicrosoftEvent",
  "getValidAccessToken",
] as const;

for (const name of required) {
  assert.match(
    source,
    new RegExp(`\\b${name}\\b`),
    `${name} must be re-exported in src/lib/voice/calendar/providers.ts`,
  );
}

console.log("VOICE_CALENDAR_PROVIDERS_BARREL_OK", { exports: required.length });
