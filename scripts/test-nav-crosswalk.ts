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

// Launch sidebar covers core product areas.
const solutionsHrefs = new Set(collectNavHrefs(solutionsNav));
assert.ok(solutionsHrefs.has("/outcomes"), "Dashboard required");
assert.ok(solutionsHrefs.has("/voice/agents"), "AI Receptionist required");
assert.ok(solutionsHrefs.has("/inbox"), "Messages required");
assert.ok(solutionsHrefs.has("/contacts"), "Contacts required");
assert.ok(solutionsHrefs.has("/integrations/native/appointments"), "Appointments required");
assert.ok(solutionsHrefs.has("/automations"), "Automations required");
assert.ok(solutionsHrefs.has("/integrations"), "Integrations required");
assert.ok(solutionsHrefs.has("/settings/business"), "Settings required");

const expectedTopLevel = [
  "Dashboard",
  "AI Receptionist",
  "Missed Call Text Back",
  "Messages",
  "Contacts",
  "Appointments",
  "Automations",
  "Integrations",
  "Settings",
];
assert.deepEqual(
  solutionsNav.map((item) => item.label),
  expectedTopLevel,
  "Launch sidebar top-level labels must match the product scope",
);

for (const slug of solutionsLaunchSlugs()) {
  const reachable = [...solutionsHrefs].some((href) => href.includes(`/outcomes/${slug}`));
  assert.ok(reachable, `Outcome ${slug} missing from solutionsNav`);
}

const receptionist = solutionsNav.find((i) => i.label === "AI Receptionist");
assert.ok(receptionist, "AI Receptionist required");
assert.deepEqual(
  (receptionist?.children || []).map((c) => c.label),
  ["My Agent", "Instructions", "Knowledge", "Actions", "Voice", "Test", "Advanced"],
  "AI Receptionist submenu must match editor tabs",
);

const withAgent = buildSolutionsNav({ primaryVoiceAgentId: "agent_test_1" });
const receptionistWithAgent = withAgent.find((i) => i.label === "AI Receptionist");
assert.ok(receptionistWithAgent, "AI Receptionist with agent required");
assert.equal(
  receptionistWithAgent?.href,
  "/voice/agents/agent_test_1",
  "AI Receptionist parent should open primary agent overview",
);
assert.equal(
  receptionistWithAgent?.children?.find((c) => c.label === "Instructions")?.href,
  "/voice/agents/agent_test_1/instructions",
  "Instructions sidebar must deep-link to agent editor",
);
assert.equal(
  receptionistWithAgent?.children?.find((c) => c.label === "Advanced")?.href,
  "/voice/agents/agent_test_1/advanced",
  "Advanced sidebar must deep-link to agent editor",
);

const mctb = solutionsNav.find((i) => i.label === "Missed Call Text Back");
assert.ok(mctb, "Missed Call Text Back required");
assert.deepEqual(
  (mctb?.children || []).map((c) => c.label),
  ["Setup", "Message", "Rules", "Activity"],
  "Missed Call Text Back submenu must stay light",
);

const messages = solutionsNav.find((i) => i.label === "Messages");
assert.ok(messages, "Messages required");
assert.deepEqual(
  (messages?.children || []).map((c) => c.label),
  ["SMS", "Templates", "Scheduled", "Sent"],
  "Messages submenu must stay light",
);

const contacts = solutionsNav.find((i) => i.label === "Contacts");
assert.ok(contacts, "Contacts required");
assert.deepEqual(
  (contacts?.children || []).map((c) => c.label),
  ["All Contacts", "Lists", "Tags", "Import"],
  "Contacts submenu must stay light",
);

const appointments = solutionsNav.find((i) => i.label === "Appointments");
assert.ok(appointments, "Appointments required");
assert.deepEqual(
  (appointments?.children || []).map((c) => c.label),
  ["Appointments", "Calendar", "Connections", "Availability"],
  "Appointments submenu must stay light",
);

const automations = solutionsNav.find((i) => i.label === "Automations");
assert.ok(automations, "Automations required");
assert.deepEqual(
  (automations?.children || []).map((c) => c.label),
  ["Flows", "Templates", "Logs"],
  "Automations sidebar must be Flows / Templates / Logs",
);

const integrations = solutionsNav.find((i) => i.label === "Integrations");
assert.ok(integrations, "Integrations required");
assert.deepEqual(
  (integrations?.children || []).map((c) => c.label),
  ["Calendars", "CRM", "Webhooks"],
  "Integrations submenu must stay light",
);

const settings = solutionsNav.find((i) => i.label === "Settings");
assert.ok(settings, "Settings required");
assert.deepEqual(
  (settings?.children || []).map((c) => c.label),
  ["Business", "AI", "Messaging", "Appointments", "Compliance", "Billing"],
  "Settings submenu must stay light",
);

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
