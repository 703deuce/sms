/**
 * Assert every legacy sidebar route remains reachable in the new appNav.
 * Run: npx tsx scripts/test-nav-crosswalk.ts
 */

import assert from "assert";
import {
  LEGACY_APP_NAV_HREFS,
  appNav,
  collectNavHrefs,
} from "../src/lib/nav";
import { solutionCategories } from "../src/lib/solutions-catalog";

const navHrefs = new Set(collectNavHrefs(appNav));

const missingLegacy = LEGACY_APP_NAV_HREFS.filter((href) => !navHrefs.has(href));
assert.deepEqual(
  missingLegacy,
  [],
  `Legacy routes missing from appNav: ${missingLegacy.join(", ")}`,
);

// Send Campaign must live inside Messaging (not only as a floating CTA).
assert.ok(navHrefs.has("/send"), "Send Campaign (/send) must appear in Messaging nav");

const messaging = appNav.find((item) => item.label === "Messaging");
assert.ok(messaging, "Messaging section required");
const messagingHrefs = collectNavHrefs([messaging]);
assert.ok(messagingHrefs.includes("/send"), "Send Campaign must be under Messaging");

const requiredTopLevel = [
  "Dashboard",
  "Solutions",
  "Messaging",
  "Contacts",
  "Automations",
  "Growth",
  "Surveys",
  "AI Voice",
  "Business Phone",
  "Reports",
  "Phone Numbers",
  "Integrations",
  "Compliance",
  "Settings",
];
assert.deepEqual(
  appNav.map((item) => item.label),
  requiredTopLevel,
  "Top-level sidebar labels must match the complete navigation crosswalk",
);

for (const category of solutionCategories) {
  for (const solution of category.solutions) {
    assert.ok(
      navHrefs.has(solution.href),
      `Solution ${solution.href} missing from appNav`,
    );
  }
}

// Solution Center hub
assert.ok(navHrefs.has("/solutions"));

console.log(
  `nav crosswalk passed: ${LEGACY_APP_NAV_HREFS.length} legacy routes + Solutions layer accounted for (${navHrefs.size} total nav hrefs)`,
);
