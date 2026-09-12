import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";

const files = [
  "src/features/mctb/booking/calendar/mctb-calendar-connected.tsx",
  "src/features/mctb/booking/list/mctb-list-connected.tsx",
  "src/features/mctb/booking/reminders/mctb-reminders-connected.tsx",
  "src/features/mctb/booking/booking-setup/mctb-booking-setup-connected.tsx",
  "src/app/(app)/mctb/calendar/page.tsx",
  "src/app/(app)/mctb/appointments/page.tsx",
  "src/app/(app)/mctb/booking/page.tsx",
  "src/app/(app)/mctb/reminders/page.tsx",
  "docs/MCTB-LIGHT-BOOKING-COPY-SOURCE-MAP.md",
  "docs/MCTB-BOOKING-BACKEND-REUSE-MATRIX.md",
];

for (const f of files) {
  assert.ok(existsSync(f), `missing ${f}`);
}

const calendar = readFileSync("src/features/mctb/booking/calendar/mctb-calendar-connected.tsx", "utf8");
assert.ok(calendar.includes("derived from canonical"), "calendar copy comment");
assert.ok(calendar.includes("/api/calendar/events"), "calendar uses canonical events API");
assert.ok(calendar.includes("MCTB_CALENDAR_BASE"), "mctb calendar routes");
assert.ok(!calendar.includes("CalendarWaitlistMatchDrawer"), "waitlist drawer trimmed");

const list = readFileSync("src/features/mctb/booking/list/mctb-list-connected.tsx", "utf8");
assert.ok(list.includes("/api/appointments"), "list uses canonical appointments API");
assert.ok(list.includes("MctbListConnected"), "mctb list export");

assert.equal(MCTB_ROUTES.calendar, "/mctb/calendar");
assert.equal(MCTB_ROUTES.appointments, "/mctb/appointments");
assert.equal(MCTB_ROUTES.booking, "/mctb/booking");
assert.equal(MCTB_ROUTES.reminders, "/mctb/reminders");

const nav = readFileSync("src/lib/products/mctb-nav.ts", "utf8");
assert.ok(nav.includes("MCTB_ROUTES.calendar"), "nav includes calendar");
assert.ok(nav.includes("MCTB_ROUTES.reminders"), "nav includes reminders");

console.log("test-mctb-light-booking: OK");
