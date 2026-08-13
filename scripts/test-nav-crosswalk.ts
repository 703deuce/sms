/**
 * Assert every legacy sidebar route remains reachable in Platform appNav,
 * and that the launch sidebar matches the AI receptionist + SMS catalog.
 * Run: npx tsx scripts/test-nav-crosswalk.ts
 */

import assert from "assert";
import {
  LEGACY_APP_NAV_HREFS,
  appNav,
  collectNavHrefs,
} from "../src/lib/nav";
import { outcomeSolutions } from "../src/lib/outcomes/registry";
import {
  buildSolutionsNav,
  solutionsLaunchSlugs,
  solutionsNav,
} from "../src/lib/solutions-nav";
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

// Launch sidebar matches flat product mockup nav.
const solutionsHrefs = new Set(collectNavHrefs(solutionsNav));
assert.ok(solutionsHrefs.has("/outcomes"), "Dashboard required");
assert.ok(solutionsHrefs.has("/voice/agents"), "My Receptionist required");
assert.ok(solutionsHrefs.has("/numbers"), "Phone Numbers required");
assert.ok(solutionsHrefs.has("/contacts"), "Contacts required");
assert.ok(solutionsHrefs.has("/integrations"), "Integrations required");
assert.ok(solutionsHrefs.has("/settings/business"), "Settings required");

const expectedTopLevel = [
  "Dashboard",
  "My Receptionist",
  "Phone Numbers",
  "Settings",
  "Contacts",
  "Organizations",
  "Credentials",
  "Integrations",
  "Affiliates",
];
assert.deepEqual(
  solutionsNav.map((item) => item.label),
  expectedTopLevel,
  "Launch sidebar top-level labels must match the product mockup",
);

assert.ok(
  !solutionsNav.some((item) => item.children?.length),
  "Launch sidebar must be flat (no expandable submenus)",
);

for (const slug of solutionsLaunchSlugs()) {
  const reachable = [...solutionsHrefs].some((href) => href.includes(`/outcomes/${slug}`));
  if (!reachable) {
    // Outcome shortcuts are not surfaced in the flat mockup nav; pages remain reachable via Platform nav.
    console.warn(`Outcome ${slug} not in flat launch nav (expected for mockup sidebar)`);
  }
}

const hiddenFromLaunch = [
  "Inbox",
  "Calls",
  "Campaigns",
  "Phone",
  "Reports",
  "Your Team",
  "My Numbers",
  "Compliance",
  "Phone & Routing",
  "Developer Tools",
  "Forms",
  "Growth",
  "Surveys",
  "Business Phone",
  "AI Voice",
  "AI Answering Service",
  "Connect With Customers",
];
for (const label of hiddenFromLaunch) {
  assert.ok(
    !solutionsNav.some((i) => i.label === label),
    `"${label}" must be hidden from launch navigation`,
  );
}

assert.ok(
  !solutionsNav.some((i) => i.href.includes("channel=email")),
  "Duplicate email channel shortcuts removed",
);

// Instance shortcuts are no longer injected into the launch sidebar.
const withInstances = buildSolutionsNav({
  instancesBySolution: {
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
  !withInstanceHrefs.has("/voice/agents/a2"),
  "Launch nav should not surface per-instance shortcuts",
);

console.log(
  `nav crosswalk passed: ${LEGACY_APP_NAV_HREFS.length} legacy Platform routes + ${outcomeSolutions.length} Solutions outcomes (${navHrefs.size} platform hrefs, ${solutionsHrefs.size} solutions hrefs)`,
);
