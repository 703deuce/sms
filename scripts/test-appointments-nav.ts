#!/usr/bin/env tsx
/**
 * Appointments V1 sidebar structure — ten-domain IA.
 * Run: npx tsx scripts/test-appointments-nav.ts
 */
import assert from "node:assert/strict";
import { buildAppointmentsV1Nav } from "../src/lib/products/appointments-nav";
import { collectNavHrefs } from "../src/lib/nav";

const nav = buildAppointmentsV1Nav();
const labels = nav.map((i) => i.label);
const hrefs = collectNavHrefs(nav);

assert.ok(labels.includes("Home"));
assert.ok(labels.includes("Appointments"));
assert.ok(labels.includes("Booking"));
assert.ok(labels.includes("Messages"));
assert.ok(labels.includes("Automations"));
assert.ok(labels.includes("Meetings"));
assert.ok(labels.includes("Payments"));
assert.ok(labels.includes("Analytics"));
assert.ok(labels.includes("Integrations"));
assert.ok(labels.includes("Settings"));

assert.ok(!labels.includes("Overview"));
assert.ok(!labels.includes("Scheduled"));
assert.ok(!labels.includes("Get Started"));
assert.ok(!labels.includes("Enterprise"));
assert.ok(!labels.includes("Locations"));
assert.ok(!labels.includes("Grow"));
assert.ok(!labels.includes("Numbers"));
assert.ok(!labels.includes("Compliance"));

assert.ok(hrefs.includes("/appointments/calendar"));
assert.ok(hrefs.includes("/appointments"));
assert.ok(hrefs.includes("/appointments/waitlist"));
assert.ok(hrefs.includes("/appointments/recalls"));
assert.ok(hrefs.includes("/appointments/types"));
assert.ok(hrefs.includes("/appointments/booking"));
assert.ok(hrefs.includes("/appointments/ai-booking"));
assert.ok(hrefs.includes("/appointments/automations/activity"));
assert.ok(hrefs.includes("/payments/transactions"));
assert.ok(hrefs.includes("/integrations/calendars"));
assert.ok(hrefs.includes("/settings/messaging"));

const appointments = nav.find((i) => i.label === "Appointments");
assert.ok(appointments?.children?.length === 4);

const messages = nav.find((i) => i.label === "Messages");
assert.equal(messages?.label, "Messages");

console.log("PASS appointments nav uses ten-domain IA");
console.log("PASS legacy SMS marketing surfaces removed from nav");
console.log("\nAll appointments nav tests passed.");
