#!/usr/bin/env node
/**
 * Focused static checks for four-object Booking IA (no browser cert).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

// Routes exist
for (const route of [
  "src/app/(app)/appointments/meetings/page.tsx",
  "src/app/(app)/appointments/services/page.tsx",
  "src/app/(app)/appointments/classes/page.tsx",
  "src/app/(app)/appointments/workshops/page.tsx",
]) {
  assert(existsSync(join(root, route)), `Missing page: ${route}`);
}

// Nav lists four objects first, not Booking Types
const nav = read("src/lib/products/appointments-nav.ts");
assert(nav.includes('label: "Meetings"'), "Nav missing Meetings");
assert(nav.includes('label: "Workshops"'), "Nav missing Workshops");
assert(!nav.includes('label: "Booking Types"'), "Nav still exposes Booking Types");

// Locked editor hides kind picker
const editor = read("src/components/appointments/kimi-ui/appointment-types/components/TypeEditorPanel.tsx");
assert(editor.includes("hideKindPicker"), "TypeEditorPanel missing hideKindPicker");

// Legacy hub redirects
const typesPage = read("src/app/(app)/appointments/types/page.tsx");
assert(typesPage.includes("LegacyBookingTypesRedirect"), "Types page must redirect");

// Class series offering helpers
const offering = read("src/lib/appointments/class-series-offering.ts");
assert(offering.includes("workshop"), "Class series offering helper missing workshop");

// Docs
for (const doc of [
  "docs/APPOINTMENTS-FOUR-BOOKABLE-OBJECTS-IA.md",
  "docs/APPOINTMENTS-BOOKING-TYPES-HUB-RETIREMENT-AUDIT.md",
  "docs/APPOINTMENTS-BOOKABLE-OBJECT-EDITOR-MATRIX.md",
  "docs/APPOINTMENTS-BOOKABLE-OBJECT-COMPONENT-CONTRACT.md",
]) {
  assert(existsSync(join(root, doc)), `Missing doc: ${doc}`);
}

if (failures.length) {
  console.error("FAIL — booking four-object IA checks:\n");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("PASS — booking four-object IA static checks");
