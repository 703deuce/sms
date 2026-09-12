import assert from "node:assert/strict";
import { defaultHandoffConfig } from "../src/lib/mctb/handoff/defaults";
import {
  alertsActiveLabel,
  handoffFlowSteps,
  notificationsSnapshotsEqual,
  ROUTING_EVENT_ROWS,
  routingRow,
} from "../src/lib/mctb/setup-notifications-model";
import { resolveMctbSetupSectionId } from "../src/lib/mctb/setup-sections";

assert.equal(resolveMctbSetupSectionId("/mctb/setup/notifications"), "notifications");

const cfg = defaultHandoffConfig();
assert.ok(ROUTING_EVENT_ROWS.includes("caller_replied"));
const row = routingRow(cfg, "caller_replied");
assert.ok(row.channels.sms || row.channels.in_app);

assert.equal(alertsActiveLabel([]), "Needs setup");
assert.ok(handoffFlowSteps("ai_conversation").length >= 4);

const snapA = { config: cfg, recipients: [] };
const snapB = { config: { ...cfg }, recipients: [] };
assert.equal(notificationsSnapshotsEqual(snapA, snapB), true);

console.log("test-mctb-setup-notifications: ok");
