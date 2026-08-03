/**
 * Assert every legacy sidebar route remains reachable in Platform appNav,
 * and that Solutions view covers the outcome-based navigation.
 * Run: npx tsx scripts/test-nav-crosswalk.ts
 */

import assert from "assert";
import {
  LEGACY_APP_NAV_HREFS,
  appNav,
  collectNavHrefs,
} from "../src/lib/nav";
import { outcomeSolutions } from "../src/lib/outcomes/registry";
import { buildSolutionsNav, solutionsNav } from "../src/lib/solutions-nav";
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

// Platform view: Solutions top-level section removed (Solutions mode replaces it).
assert.ok(
  !appNav.some((item) => item.label === "Solutions"),
  "Platform appNav must not include a top-level Solutions section",
);

const requiredTopLevel = [
  "Dashboard",
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
  "Top-level Platform sidebar labels must match the navigation crosswalk",
);

// Legacy solution catalog URLs remain valid pages even if not in Platform nav.
for (const category of solutionCategories) {
  for (const solution of category.solutions) {
    assert.ok(
      solution.href.startsWith("/solutions/"),
      `Catalog solution href looks wrong: ${solution.href}`,
    );
  }
}

// Solutions view covers outcome dashboards and permanent solution sections.
const solutionsHrefs = new Set(collectNavHrefs(solutionsNav));
assert.ok(solutionsHrefs.has("/outcomes"), "Solutions dashboard required");

// Launch menu outcomes (ai-receptionist hub is route-only, not a nav row).
const launchSlugs = outcomeSolutions
  .filter((s) => s.slug !== "ai-receptionist")
  .map((s) => s.slug);
for (const slug of launchSlugs) {
  assert.ok(
    solutionsHrefs.has(`/outcomes/${slug}`),
    `Outcome ${slug} missing from solutionsNav`,
  );
}

// Adaptive submenu: before setup, only Overview + Set Up for managed call solutions.
const answering = solutionsNav.find((i) => i.label === "AI Answering Service");
assert.ok(answering, "AI Answering Service required");
const answeringChildLabels = (answering.children || []).map((c) =>
  "type" in c && c.type === "group" ? c.label : c.label,
);
assert.deepEqual(
  answeringChildLabels,
  ["Overview", "Set Up"],
  "Empty AI Answering Service submenu should only show Overview + Set Up",
);

const withInstances = buildSolutionsNav({
  instancesBySolution: {
    "appointment-booking": [
      {
        id: "a1",
        label: "Main Office Booking",
        status: "Active",
        href: "/voice/agents/a1",
      },
    ],
    "answer-every-call": [
      {
        id: "a2",
        label: "Maya — Main Office",
        status: "Active",
        href: "/voice/agents/a2",
      },
    ],
  },
});
const withInstanceHrefs = new Set(collectNavHrefs(withInstances));
assert.ok(
  withInstanceHrefs.has("/voice/agents/a1"),
  "Instance shortcuts should appear in Solutions nav when 1–2 setups exist",
);
const answeringWith = withInstances.find((i) => i.label === "AI Answering Service");
const answeringWithLabels = (answeringWith?.children || []).map((c) =>
  "type" in c && c.type === "group" ? c.label : (c as { label: string }).label,
);
assert.ok(
  answeringWithLabels.includes("+ Set Up Another"),
  "After setup, Set Up should rename to + Set Up Another",
);
assert.ok(
  answeringWithLabels.some((l) => l.includes("Maya — Main Office")),
  "After setup, instance name should appear in the submenu",
);
assert.ok(
  !answeringWithLabels.includes("Answering Rules"),
  "Full management pages should nest under the instance, not top-level, when 1–2 setups exist",
);

console.log(
  `nav crosswalk passed: ${LEGACY_APP_NAV_HREFS.length} legacy Platform routes + ${outcomeSolutions.length} Solutions outcomes (${navHrefs.size} platform hrefs, ${solutionsHrefs.size} solutions hrefs)`,
);
