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
  buildReceptionistNavChildren,
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

// Launch sidebar matches simplified product nav.
const solutionsHrefs = new Set(collectNavHrefs(solutionsNav));
assert.ok(solutionsHrefs.has("/outcomes"), "Dashboard required");
assert.ok(solutionsHrefs.has("/voice/receptionist"), "AI Receptionist landing required");
assert.ok(solutionsHrefs.has("/voice/agents"), "My Agents required");
assert.ok(solutionsHrefs.has("/voice/calls"), "Calls required");
assert.ok(solutionsHrefs.has("/inbox"), "Inbox required under SMS");
assert.ok(solutionsHrefs.has("/send/quick"), "Broadcast required");
assert.ok(solutionsHrefs.has("/campaigns"), "Campaigns required");
assert.ok(solutionsHrefs.has("/templates"), "Templates required");
assert.ok(solutionsHrefs.has("/automations"), "Automations required");
assert.ok(solutionsHrefs.has("/integrations/native/appointments"), "Appointments required");
assert.ok(solutionsHrefs.has("/numbers"), "Phone Numbers required");
assert.ok(solutionsHrefs.has("/numbers/buy"), "Buy Number required");
assert.ok(solutionsHrefs.has("/compliance"), "Compliance required");
assert.ok(solutionsHrefs.has("/contacts"), "Contacts required");
assert.ok(solutionsHrefs.has("/integrations"), "Integrations required");
assert.ok(solutionsHrefs.has("/settings/business"), "Settings required");
assert.ok(solutionsHrefs.has("/reports/usage"), "Usage & Billing required");

const expectedTopLevel = [
  "Dashboard",
  "AI Receptionist",
  "Calls",
  "SMS",
  "Contacts",
  "Automations",
  "Appointments",
  "Phone Numbers",
  "Compliance",
  "Integrations",
  "Settings",
];
assert.deepEqual(
  solutionsNav.map((item) => item.label),
  expectedTopLevel,
  "Launch sidebar top-level labels must match the product mockup",
);

const receptionistNav = solutionsNav.find((item) => item.label === "AI Receptionist");
assert.ok(receptionistNav, "AI Receptionist nav item required");
assert.ok(receptionistNav?.children?.length, "AI Receptionist must expose wizard shortcuts");
assert.deepEqual(
  receptionistNav?.children?.map((c) => c.label),
  buildReceptionistNavChildren(null).map((c) => c.label),
  "AI Receptionist submenu labels must match wizard shortcuts",
);

const smsNav = solutionsNav.find((item) => item.label === "SMS");
assert.ok(smsNav?.children?.map((c) => c.label), "SMS submenu required");
assert.deepEqual(smsNav?.children?.map((c) => c.label), [
  "Inbox",
  "Broadcast",
  "Campaigns",
  "Templates",
]);

for (const slug of solutionsLaunchSlugs()) {
  const reachable = [...solutionsHrefs].some((href) => href.includes(`/outcomes/${slug}`));
  if (!reachable) {
    console.warn(`Outcome ${slug} not in flat launch nav (expected for mockup sidebar)`);
  }
}

const hiddenFromLaunch = [
  "Campaigns",
  "Phone",
  "Reports",
  "Your Team",
  "My Numbers",
  "Phone & Routing",
  "Developer Tools",
  "Forms",
  "Growth",
  "Surveys",
  "Business Phone",
  "AI Voice",
  "AI Answering Service",
  "Connect With Customers",
  "Organizations",
  "Credentials",
  "Affiliates",
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
  primaryVoiceAgentId: "a2",
});
const withInstanceHrefs = new Set(collectNavHrefs(withInstances));
assert.ok(
  withInstanceHrefs.has(`/voice/agents/a2/capabilities`),
  "Launch nav should deep-link wizard steps for the primary agent",
);
assert.ok(
  !withInstanceHrefs.has("/voice/agents/a2"),
  "Launch nav should not surface bare instance shortcuts",
);

console.log(
  `nav crosswalk passed: ${LEGACY_APP_NAV_HREFS.length} legacy Platform routes + ${outcomeSolutions.length} Solutions outcomes (${navHrefs.size} platform hrefs, ${solutionsHrefs.size} solutions hrefs)`,
);
