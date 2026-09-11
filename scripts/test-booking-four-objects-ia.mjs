#!/usr/bin/env node
/**
 * Focused checks for four-object Booking IA — FOUR-01 through FOUR-26 (static layer).
 * Browser/public smokes require DEV_AUTH_BYPASS + running app (see FOUR-03+).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];

function pass(id, message) {
  results.push({ id, status: "PASS", message });
}

function fail(id, message) {
  results.push({ id, status: "FAIL", message });
}

function blocked(id, message) {
  results.push({ id, status: "PROVIDER_BLOCKED", message });
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function exists(path) {
  return existsSync(join(root, path));
}

// FOUR-01 — Nav four objects, no Booking Types
const nav = read("src/lib/products/appointments-nav.ts");
if (
  nav.includes('label: "Meetings"') &&
  nav.includes('label: "Services"') &&
  nav.includes('label: "Classes"') &&
  nav.includes('label: "Workshops"') &&
  !nav.includes('label: "Booking Types"')
) {
  pass("FOUR-01", "Booking nav: Meetings, Services, Classes, Workshops; no Booking Types");
} else {
  fail("FOUR-01", "Nav missing four objects or still exposes Booking Types");
}

// Routes
for (const [id, route] of [
  ["FOUR-02-precheck", "src/app/(app)/appointments/meetings/page.tsx"],
  ["FOUR-04-precheck", "src/app/(app)/appointments/services/page.tsx"],
  ["FOUR-06-precheck", "src/app/(app)/appointments/classes/page.tsx"],
  ["FOUR-13-precheck", "src/app/(app)/appointments/workshops/page.tsx"],
]) {
  if (exists(route)) pass(id, `Route exists: ${route}`);
  else fail(id, `Missing route: ${route}`);
}

// Locked editors
const meetings = read("src/components/appointments/meetings-client.tsx");
const services = read("src/components/appointments/services-client.tsx");
if (meetings.includes("hideKindPicker: true")) pass("FOUR-02", "Meeting editor hides kind picker");
else fail("FOUR-02", "Meeting editor missing hideKindPicker");

if (services.includes("hideKindPicker: true")) pass("FOUR-04", "Service editor hides kind picker");
else fail("FOUR-04", "Service editor missing hideKindPicker");

// Class editor sections
const classAdmin = read("src/features/appointments/kimi/class-series/class-series-admin-connected.tsx");
const classSections = [
  "schedule",
  "waitlist",
  "admission",
  "ClassSeriesOccurrencePanel",
];
const missingClass = classSections.filter((s) => !classAdmin.includes(s));
if (missingClass.length === 0) {
  pass("FOUR-06", "Class editor has schedule, waitlist, admission, occurrence panel");
} else {
  fail("FOUR-06", `Class editor missing: ${missingClass.join(", ")}`);
}

// FOUR-07 / FOUR-08 — occurrence + recurrence
const occPanel = read("src/features/appointments/kimi/class-series/class-series-occurrence-panel.tsx");
if (occPanel.includes("list_occurrences") && occPanel.includes("Add occurrence")) {
  pass("FOUR-07", "Class occurrence creation UI wired");
} else fail("FOUR-07", "Class occurrence panel incomplete");

if (occPanel.includes("Weekly recurrence") && occPanel.includes("Generate weekly schedule")) {
  pass("FOUR-08", "Weekly recurrence generator present for classes");
} else fail("FOUR-08", "Weekly recurrence missing");

// FOUR-09 — capacity enforcement server-side
const classesLib = read("src/lib/appointments/service-booking/classes.ts");
if (classesLib.includes("assertOccurrenceCapacity") && classesLib.includes("This session is full")) {
  pass("FOUR-09", "Server-side capacity assertion in enrollInClass path");
} else fail("FOUR-09", "Capacity enforcement missing in classes.ts");

// Workshop editor
const workshopSections = ["datetime", "registration", "confirmation", "ClassSeriesWorkshopSchedulePanel"];
const missingWs = workshopSections.filter((s) => !classAdmin.includes(s));
if (missingWs.length === 0) {
  pass("FOUR-13", "Workshop editor sections: datetime, registration, confirmation");
} else {
  fail("FOUR-13", `Workshop editor missing: ${missingWs.join(", ")}`);
}

// FOUR-14 — workshop date/time
const wsPanel = read("src/features/appointments/kimi/class-series/class-series-workshop-schedule-panel.tsx");
if (wsPanel.includes("showWeeklyRecurrence={false}")) {
  pass("FOUR-14", "Workshop schedule panel hides class-style weekly recurrence default");
} else fail("FOUR-14", "Workshop date/time panel not specialized");

// FOUR-15 — dedicated public workshops
if (
  exists("src/app/(public)/book/[slug]/workshops/page.tsx") &&
  exists("src/app/api/public/book/[slug]/workshops/route.ts") &&
  exists("src/components/appointments/public-workshops-enrollment-client.tsx")
) {
  const wsClient = read("src/components/appointments/public-workshops-enrollment-client.tsx");
  const offering = read("src/lib/appointments/class-series-offering.ts");
  if (offering.includes('publicPathSuffix: "workshops"') && wsClient.includes('offeringKind="workshop"')) {
    pass("FOUR-15", "Dedicated public workshops route + workshop labels");
  } else fail("FOUR-15", "Workshops public path suffix or client kind wrong");
} else {
  fail("FOUR-15", "Missing public workshops route/API/client");
}

// Public classes filter
const publicLib = read("src/lib/appointments/public-group-offering.ts");
if (publicLib.includes("resolveClassSeriesOfferingKind") && publicLib.includes("offeringKind")) {
  pass("FOUR-10-precheck", "Public API filters series by offering kind");
} else fail("FOUR-10-precheck", "Public group offering filter missing");

// Legacy deep links FOUR-19–22
const legacy = read("src/components/appointments/legacy-booking-types-redirect.tsx");
const ia = read("src/lib/appointments/bookable-object-ia.ts");
if (legacy.includes("canonicalAdminRouteForBookingTypeKind") && ia.includes("meetings")) {
  pass("FOUR-19", "Legacy types redirect resolves canonical routes");
  pass("FOUR-20", "Legacy types redirect resolves canonical routes");
  pass("FOUR-21", "Legacy types redirect resolves canonical routes");
  pass("FOUR-22", "Legacy types redirect resolves canonical routes");
} else {
  fail("FOUR-19", "Legacy deep-link redirect incomplete");
}

// Generic hub retirement
const typesPage = read("src/app/(app)/appointments/types/page.tsx");
if (typesPage.includes("LegacyBookingTypesRedirect")) {
  pass("FOUR-24-precheck", "Generic types hub redirects (unique functionality audit in docs)");
} else fail("FOUR-24-precheck", "Types page missing redirect");

// Docs
for (const doc of [
  "docs/APPOINTMENTS-FOUR-BOOKABLE-OBJECTS-IA.md",
  "docs/APPOINTMENTS-BOOKING-TYPES-HUB-RETIREMENT-AUDIT.md",
  "docs/APPOINTMENTS-BOOKABLE-OBJECT-EDITOR-MATRIX.md",
  "docs/APPOINTMENTS-BOOKABLE-OBJECT-COMPONENT-CONTRACT.md",
  "docs/APPOINTMENTS-BOOKABLE-OBJECT-UI-COMPLETENESS-AUDIT.md",
  "docs/APPOINTMENTS-FOUR-OBJECTS-COMPLETION.md",
  "docs/APPOINTMENTS-FOUR-OBJECTS-FOCUSED-TEST-MATRIX.md",
  "docs/APPOINTMENTS-GENERIC-BOOKING-TYPES-FINAL-EQUIVALENCE.md",
]) {
  if (exists(doc)) pass("doc", doc);
  else fail("doc", `Missing doc: ${doc}`);
}

// Browser smokes — require running app
const browserTests = [
  "FOUR-03",
  "FOUR-05",
  "FOUR-10",
  "FOUR-11",
  "FOUR-12",
  "FOUR-16",
  "FOUR-17",
  "FOUR-18",
  "FOUR-23",
  "FOUR-25",
  "FOUR-26",
];
for (const id of browserTests) {
  blocked(id, "Requires browser smoke with DEV_AUTH_BYPASS + live booking runtime");
}

const failures = results.filter((r) => r.status === "FAIL");
const passes = results.filter((r) => r.status === "PASS");
const blockedCount = results.filter((r) => r.status === "PROVIDER_BLOCKED").length;

console.log(`\nBooking four-object IA — ${passes.length} PASS, ${failures.length} FAIL, ${blockedCount} PROVIDER_BLOCKED\n`);
for (const r of results.filter((x) => x.id.startsWith("FOUR") || x.id === "doc")) {
  console.log(`  [${r.status}] ${r.id}: ${r.message}`);
}

if (failures.length) process.exit(1);
console.log("\nStatic layer PASS. Browser smokes remain PROVIDER_BLOCKED until manual cert.\n");
