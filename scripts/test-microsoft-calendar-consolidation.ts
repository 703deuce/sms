import assert from "node:assert/strict";
import { mergeCalendarConnectionConfig } from "../src/lib/calendar/connection-config-merge";

/** Pure helpers mirrored from microsoft-connection-consolidation for fast unit check */
function pickImport(config: Record<string, unknown>) {
  const ids = config.importCalendarIds as string[] | undefined;
  if (!ids?.length) return {};
  return { importCalendarIds: ids, writeCalendarId: config.writeCalendarId };
}

function main() {
  const active = { email: "a@b.com", accessToken: "new" };
  const sibling = {
    email: "a@b.com",
    importCalendarIds: ["cal-1"],
    writeCalendarId: "cal-1",
    microsoftDeltaLinks: {
      "cal-1": { deltaLink: "https://delta", updatedAt: "2026-10-11T00:00:00.000Z" },
    },
  };
  const patch = pickImport(sibling);
  const merged = mergeCalendarConnectionConfig(active, patch);
  assert.deepEqual(merged.importCalendarIds, ["cal-1"]);
  assert.equal(merged.writeCalendarId, "cal-1");
  console.log("PASS microsoft calendar consolidation merge");
}

main();
