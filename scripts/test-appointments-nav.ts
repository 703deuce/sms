#!/usr/bin/env tsx
/**
 * Appointments V1 sidebar structure — Batch 7 automations/reporting/contact support.
 * Run: npx tsx scripts/test-appointments-nav.ts
 */
import assert from "node:assert/strict";
import { buildAppointmentsV1Nav } from "../src/lib/products/appointments-nav";
import { collectNavHrefs } from "../src/lib/nav";

const nav = buildAppointmentsV1Nav({ modules: { workflows: true } });
const labels = nav.map((i) => i.label);
const hrefs = collectNavHrefs(nav);

assert.ok(labels.includes("Home"));
assert.ok(labels.includes("Booking"));
assert.ok(labels.includes("Calendar"));
assert.ok(labels.includes("Automations"));
assert.ok(labels.includes("Analytics"));
assert.ok(labels.includes("Settings"));

assert.ok(!labels.includes("Reminders"), "Reminders merged into Automations");
assert.ok(!labels.includes("Overview"));
assert.ok(!hrefs.includes("/appointments/segments"), "Segments moved under Contacts");
assert.ok(!hrefs.includes("/appointments/reports/service-booking"), "Reports merged into Analytics");

assert.ok(hrefs.includes("/appointments/calendar"));
assert.ok(hrefs.includes("/appointments/recalls"));
assert.ok(hrefs.includes("/appointments/reminders"));
assert.ok(hrefs.includes("/appointments/workflows"));
assert.ok(hrefs.includes("/appointments/automations/activity"));
assert.ok(hrefs.includes("/appointments/automations/recall"));
assert.ok(hrefs.includes("/appointments/automations/no-show"));
assert.ok(hrefs.includes("/appointments/analytics/revenue"));
assert.ok(hrefs.includes("/appointments/analytics/reports"));
assert.ok(hrefs.includes("/contacts/segments"));
assert.ok(hrefs.includes("/contacts/fields"));
assert.ok(hrefs.includes("/contacts/imports"));

const automations = nav.find((i) => i.label === "Automations");
assert.ok(automations?.children?.some((c) => c.label === "Recall automation"));
assert.ok(automations?.children?.some((c) => c.label === "No-show follow-up"));

const contacts = nav.find((i) => i.label === "Contacts");
assert.ok(contacts?.children?.some((c) => c.href === "/contacts/segments"));
assert.ok(contacts?.children?.some((c) => c.href === "/contacts/fields"));
assert.ok(contacts?.children?.some((c) => c.href === "/contacts/imports"));

console.log("PASS appointments nav Batch 7 structure");
console.log("\nAll appointments nav tests passed.");
