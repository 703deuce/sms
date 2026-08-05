/**
 * Assert every legacy sidebar route remains reachable in Platform appNav,
 * and that the unified Solutions-first nav covers the launch catalog.
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

// Unified product nav covers outcome dashboards and management.
const solutionsHrefs = new Set(collectNavHrefs(solutionsNav));
assert.ok(solutionsHrefs.has("/outcomes"), "Solutions dashboard required");
assert.ok(solutionsHrefs.has("/systems"), "My Agents inventory required");

assert.equal(solutionsNav[0]?.label, "Dashboard");
assert.equal(solutionsNav[1]?.label, "My Agents");
assert.equal(solutionsNav[1]?.href, "/systems");
assert.equal(solutionsNav[2]?.label, "My Numbers");
assert.equal(solutionsNav[2]?.href, "/my-numbers");
assert.equal(solutionsNav[3]?.label, "Deployments");
assert.equal(solutionsNav[3]?.href, "/deployments");
assert.ok(solutionsHrefs.has("/my-numbers"), "My Numbers inventory required");
assert.ok(solutionsHrefs.has("/deployments"), "Deployments inventory required");

for (const slug of solutionsLaunchSlugs()) {
  assert.ok(
    solutionsHrefs.has(`/outcomes/${slug}`),
    `Outcome ${slug} missing from solutionsNav`,
  );
}

const expectedLaunchMenu: Array<{
  section?: string;
  area?: string;
  labels: string[];
}> = [
  {
    area: "AI Receptionist",
    labels: [
      "AI Answering Service",
      "Cover Missed Calls",
      "Answer After Hours",
      "Book Appointments",
      "Capture & Screen Inquiries",
    ],
  },
  {
    area: "SMS & Messaging",
    labels: [
      "Missed Call Text Back",
      "Respond & Follow Up",
      "Follow Up on Estimates",
      "Appointment Reminders",
      "Get More Reviews",
      "Reconnect With Old Inquiries",
      "Bring Back Past Customers",
      "Send Promotions & Announcements",
    ],
  },
];

const launchItems = solutionsNav.filter((i) => i.href.startsWith("/outcomes/"));
let cursor = 0;
for (const section of expectedLaunchMenu) {
  if (section.section) {
    assert.equal(
      launchItems[cursor]?.sectionLabel,
      section.section,
      `Expected section ${section.section} at position ${cursor}`,
    );
  } else {
    assert.equal(
      launchItems[cursor]?.sectionLabel,
      undefined,
      `Expected no Solutions band at position ${cursor}`,
    );
  }
  if (section.area) {
    assert.equal(
      launchItems[cursor]?.areaLabel,
      section.area,
      `Expected area ${section.area} at position ${cursor}`,
    );
  }
  for (const label of section.labels) {
    assert.equal(
      launchItems[cursor]?.label,
      label,
      `Expected catalog menu item "${label}"`,
    );
    cursor += 1;
  }
}
assert.equal(cursor, 13, "Packaged catalog should be 13 items");

const connect = solutionsNav.find(
  (i) => i.areaLabel === "Connect With Customers",
);
assert.ok(connect, "Connect With Customers area required");
const connectStart = solutionsNav.indexOf(connect!);
const connectLabels = [
  "Forms",
  "Website Popups",
  "Signup Pages",
  "QR Codes",
  "Click-to-Text",
  "Contact Cards",
  "Text-to-Pay",
];
for (let i = 0; i < connectLabels.length; i += 1) {
  assert.equal(
    solutionsNav[connectStart + i]?.label,
    connectLabels[i],
    `Expected Connect item "${connectLabels[i]}"`,
  );
}

const manageOrder = [
  "Automations",
  "Inbox",
  "Calls",
  "Campaigns",
  "Contacts",
  "Calendar",
  "Phone",
  "Reports",
  "Integrations",
  "Compliance",
];
const manageStart = solutionsNav.findIndex((i) => i.label === "Automations");
assert.ok(manageStart >= 0, "Automations required under Manage");
assert.equal(
  solutionsNav[manageStart]?.sectionLabel,
  "Manage",
  "Automations starts the Manage band",
);
assert.ok(
  !solutionsNav.some((i) => i.label === "My Systems"),
  "My Systems renamed/moved — should not remain under Manage",
);
for (let i = 0; i < manageOrder.length; i += 1) {
  assert.equal(
    solutionsNav[manageStart + i]?.label,
    manageOrder[i],
    `Expected Manage item "${manageOrder[i]}"`,
  );
}

const automations = solutionsNav.find((i) => i.label === "Automations");
assert.ok(automations, "Automations required");
const automationChildLabels = (automations?.children || []).map((c) =>
  "type" in c && c.type === "group" ? c.label : c.label,
);
assert.deepEqual(
  automationChildLabels,
  ["Flows", "Templates", "Logs"],
  "Automations sidebar must be Flows / Templates / Logs (no permanent Builder)",
);
assert.ok(
  !automationChildLabels.includes("Builder"),
  "Builder belongs to a selected flow, not the sidebar",
);

const advanced = solutionsNav.find((i) => i.sectionLabel === "Advanced");
assert.ok(advanced, "Advanced band required");
assert.equal(advanced?.label, "Phone & Routing");
assert.ok(
  solutionsNav.some((i) => i.label === "Developer Tools"),
  "Developer Tools under Advanced",
);
assert.ok(
  solutionsNav.some((i) => i.label === "Settings"),
  "Settings required",
);

const removedFromCatalog = [
  "Handle New Service Calls",
  "Customer Support",
  "Welcome New Customers",
  "Client Onboarding",
  "Run a Contest",
  "Surveys",
  "Growth",
  "Business Phone",
  "AI Voice",
];
for (const label of removedFromCatalog) {
  assert.ok(
    !solutionsNav.some((i) => i.label === label),
    `"${label}" must be hidden from launch navigation`,
  );
}

assert.ok(
  !solutionsNav.some((i) => i.href.includes("channel=email")),
  "Duplicate email channel shortcuts removed",
);

// Full permanent submenu is always visible — even before the customer sets up.
const answering = solutionsNav.find((i) => i.label === "AI Answering Service");
assert.ok(answering, "AI Answering Service required");
const answeringChildLabels = (answering.children || []).map((c) =>
  "type" in c && c.type === "group" ? c.label : c.label,
);
assert.ok(
  answeringChildLabels.includes("Overview") &&
    answeringChildLabels.includes("Set Up") &&
    answeringChildLabels.includes("Answering Rules") &&
    answeringChildLabels.includes("Calls & Results"),
  "Empty AI Answering Service submenu should still show the full management tree",
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
  answeringWithLabels.includes("Answering Rules"),
  "Full management pages remain visible alongside instance shortcuts",
);

console.log(
  `nav crosswalk passed: ${LEGACY_APP_NAV_HREFS.length} legacy Platform routes + ${outcomeSolutions.length} Solutions outcomes (${navHrefs.size} platform hrefs, ${solutionsHrefs.size} solutions hrefs)`,
);
