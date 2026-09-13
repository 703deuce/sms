#!/usr/bin/env tsx
/**
 * MCTB sidebar IA — grouped nav + shared route shell context.
 * Run: npx tsx scripts/test-mctb-nav-ia.ts
 */
import assert from "node:assert/strict";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import { collectNavHrefs } from "../src/lib/nav";
import { resolveProductSidebarNav } from "../src/lib/products/resolve-product-nav";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import { isMctbV1Primary } from "../src/lib/workspace/platform-launch";

const nav = buildMctbV1Nav();
const labels = nav.map((i) => i.label);
const hrefs = collectNavHrefs(nav);

assert.equal(labels.length, 12);
assert.deepEqual(labels, [
  "Overview",
  "Missed Calls",
  "Conversations",
  "Voicemail",
  "Analytics",
  "Setup",
  "Calendar",
  "Appointments",
  "Booking Setup",
  "Reminders",
  "Payments",
  "Integrations",
]);

assert.equal(nav[0].sectionLabel, "Missed Call Text Back");
assert.equal(nav[0].label, "Overview");
assert.equal(nav[0].href, "/mctb");
assert.equal(nav[0].matchExact, true);
assert.equal(nav[6].sectionLabel, "Booking");
assert.equal(nav[6].label, "Calendar");
assert.ok(!nav[10].sectionLabel);
assert.ok(!nav[11].sectionLabel);

assert.ok(hrefs.includes("/mctb"));
assert.ok(hrefs.includes("/payments"));
assert.ok(hrefs.includes("/integrations"));
assert.ok(!labels.includes("Home"));
assert.ok(!labels.includes("Campaigns"));
assert.ok(!labels.includes("Numbers"));

const mctbOnPayments = resolveProductSidebarNav({
  pathname: "/payments",
  multiProduct: false,
  productShell: "mctb",
  hasMctb: true,
});
assert.equal(mctbOnPayments[0]?.label, "Overview");

if (!isMctbV1Primary()) {
  const apptOnPayments = resolveProductSidebarNav({
    pathname: "/payments",
    multiProduct: false,
    productShell: "appointments",
    hasMctb: false,
  });
  assert.ok(apptOnPayments.some((i) => i.label === "Home" || i.label === "Booking"));
}

assert.equal(MCTB_ROUTES.home, "/mctb");

console.log("test-mctb-nav-ia: OK");
