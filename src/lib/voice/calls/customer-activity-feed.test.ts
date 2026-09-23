import assert from "node:assert/strict";
import { buildCustomerActivityFeed, formatCallCostCents } from "./customer-activity-feed";

function testActivityFeedOrdersEvents() {
  const items = buildCustomerActivityFeed({
    call: {
      startedAt: "2026-09-22T10:00:00.000Z",
      answeredAt: "2026-09-22T10:00:05.000Z",
      endedAt: "2026-09-22T10:05:00.000Z",
      appointmentBooked: true,
    },
    toolExecutions: [
      {
        id: "t1",
        toolType: "send_booking_link",
        status: "completed",
        createdAt: "2026-09-22T10:02:00.000Z",
      },
    ],
  });
  assert.ok(items.length >= 3);
  assert.equal(items[0].label, "Call started");
  assert.ok(items.some((i) => i.label === "Booking link sent"));
  assert.ok(items.some((i) => i.label === "Call ended"));
}

function testCostHiddenWhenZero() {
  assert.equal(formatCallCostCents(0), null);
  assert.equal(formatCallCostCents(15), "$0.15");
}

testActivityFeedOrdersEvents();
testCostHiddenWhenZero();
console.log("customer-activity-feed.test.ts: ok");
