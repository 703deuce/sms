#!/usr/bin/env tsx
/**
 * Appointments V1 sidebar structure.
 * Run: npx tsx scripts/test-appointments-nav.ts
 */
import assert from "node:assert/strict";
import { buildAppointmentsV1Nav } from "../src/lib/products/appointments-nav";

const nav = buildAppointmentsV1Nav();
const labels = nav.map((i) => i.label);

assert.ok(labels.includes("Overview"));
assert.ok(labels.includes("Calendar"));
assert.ok(labels.includes("Scheduled"));
assert.ok(labels.includes("Appointment Types"));
assert.ok(labels.includes("Availability"));
assert.ok(labels.includes("Reminder Settings"));
assert.ok(labels.includes("Booking"));
assert.ok(labels.includes("Get Started"));
assert.ok(labels.includes("Conversations"));
assert.ok(labels.includes("Analytics"));
assert.ok(!labels.includes("Numbers"));
assert.ok(!labels.includes("Compliance"));
assert.ok(!labels.includes("Appointments"));

const calendar = nav.find((i) => i.label === "Calendar");
assert.equal(calendar?.areaLabel, "Appointments");
assert.equal(calendar?.children, undefined);

console.log("PASS appointments nav is flat with Appointments section label");
console.log("PASS Numbers and Compliance removed from appointments nav");
console.log("\nAll appointments nav tests passed.");
