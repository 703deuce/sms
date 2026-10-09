/**
 * Regression: calendarView/delta must not use $top (Graph ErrorInvalidUrlQuery).
 * npx tsx scripts/test-microsoft-delta-bootstrap-request.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(process.cwd(), "src/lib/calendar/microsoft-delta-sync.ts"),
  "utf8",
);

if (/\bcalendarView\/delta[\s\S]*\$top/.test(src) || /searchParams\.set\("\$top"/.test(src)) {
  throw new Error("microsoft-delta-sync.ts must not set $top on calendarView/delta bootstrap");
}

console.log("test-microsoft-delta-bootstrap-request: PASS");
