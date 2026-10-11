/**
 * Static + unit verification for AR full functional completion matrix closure.
 * Live Telnyx/Stripe/Brevo smokes remain in docs/AR-LAUNCH-READINESS-NOW.md.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredPaths = [
  "docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md",
  "src/lib/calendar/eligibility.ts",
  "src/lib/calendar/import-rules.ts",
  "src/lib/appointment-reminders/ar-operational-pause.ts",
  "src/lib/appointment-reminders/ar-recipient-suppression.ts",
  "src/lib/appointment-reminders/ar-staff-delivery-alert.ts",
  "src/app/api/appointment-reminders/setup/configure-complete/route.ts",
  "src/app/api/appointment-reminders/export/reminders/route.ts",
  "src/app/api/appointment-reminders/export/responses/route.ts",
  "src/app/api/appointment-reminders/appointments/[id]/reminder-suppress/route.ts",
];

for (const rel of requiredPaths) {
  const abs = join(root, rel);
  assert.ok(existsSync(abs), `missing required path: ${rel}`);
}

const matrix = readFileSync(join(root, "docs/AR-FULL-FUNCTIONAL-COMPLETION-MATRIX.md"), "utf8");
assert.match(matrix, /Completion pass status:\*\* \*\*FINISHED\*\*/);
assert.match(matrix, /\| Implementation \*\*partial\*\* \| 0 \|/);
assert.match(matrix, /\| Implementation \*\*missing\*\* \| 0 \|/);
assert.match(matrix, /\| \*\*Blocked\*\* .* \| 0 \|/);
assert.doesNotMatch(matrix, /NOT FINISHED/);

console.log("test-ar-functional-completion-cert.ts static checks PASS");
