/**
 * Appointments Messages nav + route helpers (Inbox + Campaigns reuse SMS runtime).
 * Run: npx tsx scripts/test-appointments-messages-nav.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  APPOINTMENTS_CAMPAIGNS_PATH,
  APPOINTMENTS_INBOX_PATH,
  isAppointmentsMessagesPath,
} from "../src/lib/products/appointments-messages-routes.ts";
import { isAppointmentsProductPath } from "../src/lib/products/appointments-routes.ts";
import { isExplicitAppointmentsShellPath } from "../src/lib/products/product-shell.ts";

const navSource = readFileSync("src/lib/products/appointments-nav.ts", "utf8");
assert.match(navSource, /label: "Inbox".*APPOINTMENTS_INBOX_PATH/s);
assert.match(navSource, /label: "Campaigns".*APPOINTMENTS_CAMPAIGNS_PATH/s);
assert.doesNotMatch(navSource, /label: "Conversations"/);

assert.ok(isAppointmentsMessagesPath("/conversations"));
assert.ok(isAppointmentsMessagesPath("/campaigns/new"));
assert.ok(!isAppointmentsMessagesPath("/automations"));

// Product path + shell (requires APPOINTMENTS_V1_PRIMARY in env for full check)
if (process.env.APPOINTMENTS_V1_PRIMARY === "1" || process.env.APPOINTMENTS_V1_PRIMARY === "true") {
  assert.ok(isAppointmentsProductPath("/campaigns"));
  assert.ok(isExplicitAppointmentsShellPath("/campaigns/drafts"));
}

console.log("test-appointments-messages-nav: ok");
