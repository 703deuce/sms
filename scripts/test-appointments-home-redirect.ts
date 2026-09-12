import assert from "node:assert/strict";
import {
  normalizeAppointmentsPostLoginPath,
  shouldRedirectAppointmentsRootToOverview,
} from "@/lib/products/appointments-home-redirect";

assert.equal(shouldRedirectAppointmentsRootToOverview({}), true);
assert.equal(shouldRedirectAppointmentsRootToOverview({ tab: "upcoming" }), true);
assert.equal(shouldRedirectAppointmentsRootToOverview({ tab: "all" }), false);
assert.equal(shouldRedirectAppointmentsRootToOverview({ q: "dana" }), false);
assert.equal(shouldRedirectAppointmentsRootToOverview({ tab: "upcoming", staffIds: "x" }), false);

assert.equal(normalizeAppointmentsPostLoginPath("/appointments"), "/appointments/overview");
assert.equal(
  normalizeAppointmentsPostLoginPath("/appointments?tab=upcoming"),
  "/appointments/overview",
);
assert.equal(normalizeAppointmentsPostLoginPath("/appointments?tab=all"), "/appointments?tab=all");
assert.equal(normalizeAppointmentsPostLoginPath("/appointments/calendar"), "/appointments/calendar");

console.log("test-appointments-home-redirect: ok");
