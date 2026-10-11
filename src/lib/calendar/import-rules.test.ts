import assert from "node:assert/strict";
import { resolveImportRulesForCalendar } from "@/lib/calendar/import-rules";
import type { CalendarConfig } from "@/lib/calendar/providers";

const config: CalendarConfig = {
  importRules: {
    requireExternalAttendees: true,
    skipFreeShowAs: true,
  },
  importRulesByCalendarId: {
    "cal-b": {
      requireExternalAttendees: false,
    },
  },
};

const base = resolveImportRulesForCalendar(config);
assert.equal(base.requireExternalAttendees, true);
assert.equal(base.skipFreeShowAs, true);

const perCal = resolveImportRulesForCalendar(config, "cal-b");
assert.equal(perCal.requireExternalAttendees, false);
assert.equal(perCal.skipFreeShowAs, true);

const unknown = resolveImportRulesForCalendar(config, "cal-x");
assert.equal(unknown.requireExternalAttendees, true);

console.log("import-rules.test.ts PASS");
