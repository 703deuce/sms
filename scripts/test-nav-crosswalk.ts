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

// Solutions view covers outcome dashboards and permanent solution sections.
const solutionsHrefs = new Set(collectNavHrefs(solutionsNav));
assert.ok(solutionsHrefs.has("/outcomes"), "Solutions dashboard required");

// Primary launch outcomes appear in Solutions nav (Email shortcuts reuse them).
for (const slug of solutionsLaunchSlugs()) {
  assert.ok(
    solutionsHrefs.has(`/outcomes/${slug}`),
    `Outcome ${slug} missing from solutionsNav`,
  );
}

// Section headers = product areas; entries = solutions.
const expectedLaunchMenu: Array<{ section: string; labels: string[] }> = [
  {
    section: "AI Receptionist",
    labels: [
      "AI Answering Service",
      "Cover Missed Calls",
      "Answer After Hours",
      "Book Appointments",
      "Capture New Inquiries",
      "Screen New Inquiries",
      "Handle New Service Calls",
      "Customer Support",
    ],
  },
  {
    section: "SMS & Messaging",
    labels: [
      "Missed Call Text Back",
      "Respond to New Inquiries",
      "Follow Up With Inquiries",
      "Follow Up on Estimates",
      "Reconnect With Old Inquiries",
      "Appointment Reminders",
      "Get More Reviews",
      "Welcome New Customers",
      "Follow Up With Customers",
      "Payment Reminders",
      "Send a Promotion",
      "Bring Back Past Customers",
      "Get More Referrals",
      "Promote Events & Offers",
    ],
  },
];
const launchItems = solutionsNav.filter((i) => i.href.startsWith("/outcomes/"));
let cursor = 0;
for (const section of expectedLaunchMenu) {
  assert.equal(
    launchItems[cursor]?.sectionLabel,
    section.section,
    `Expected section ${section.section} at position ${cursor}`,
  );
  for (const label of section.labels) {
    assert.equal(
      launchItems[cursor]?.label,
      label,
      `Expected Solutions menu item "${label}"`,
    );
    cursor += 1;
  }
}
assert.equal(
  cursor,
  expectedLaunchMenu.reduce((n, s) => n + s.labels.length, 0),
  "Solutions launch menu length mismatch",
);

assert.ok(
  solutionsNav.some(
    (i) => i.label === "Run a Contest" && i.href === "/grow/contests",
  ),
  "Run a Contest belongs under SMS & Messaging",
);

const expectedStaticSections: Array<{ section: string; labels: string[] }> = [
  {
    section: "Connect With Customers",
    labels: [
      "Forms",
      "Website Popups",
      "Signup Pages",
      "QR Codes",
      "Click-to-Text",
      "Contact Cards",
    ],
  },
  {
    section: "Phone",
    labels: [
      "Make & Receive Calls",
      "Phone Numbers",
      "Call History",
      "Voicemail",
    ],
  },
  {
    section: "Email",
    labels: [
      "Email Activity",
      "Sent Emails",
      "Scheduled Emails",
      "Drafts",
      "Templates",
      "Email Settings",
    ],
  },
];
for (const section of expectedStaticSections) {
  const first = solutionsNav.find((i) => i.sectionLabel === section.section);
  assert.ok(first, `Section ${section.section} required`);
  const start = solutionsNav.indexOf(first!);
  for (let i = 0; i < section.labels.length; i += 1) {
    assert.equal(
      solutionsNav[start + i]?.label,
      section.labels[i],
      `Expected ${section.section} item "${section.labels[i]}"`,
    );
  }
}

assert.ok(
  !solutionsNav.some((i) => i.label === "Client Onboarding"),
  "Client Onboarding removed from Solutions catalog",
);
assert.ok(
  !solutionsHrefs.has("/outcomes/structured-onboarding"),
  "structured-onboarding must not appear in Solutions nav",
);
assert.ok(
  !solutionsNav.some((i) => i.sectionLabel === "Automations"),
  "Separate Automations solution category removed (builder lives under Advanced)",
);
assert.ok(
  !solutionsNav.some((i) => i.href.includes("channel=email")),
  "Duplicate email channel shortcuts removed from Solutions catalog",
);

const sharedSections = [
  "Inbox",
  "Contacts",
  "Calendars",
  "Integrations",
  "Reports",
  "Compliance",
  "Advanced",
  "Settings",
];
for (const label of sharedSections) {
  assert.ok(
    solutionsNav.some((i) => i.label === label),
    `Shared section ${label} required`,
  );
}
assert.ok(
  !solutionsNav.some((i) => i.sectionLabel === "Shared"),
  "Legacy Shared section header should be removed",
);

assert.ok(
  solutionsNav.some((i) => i.sectionLabel === "Phone"),
  "Phone operational section required",
);
assert.ok(
  !solutionsNav.some(
    (i) => i.label === "Phone" && i.href === "/numbers",
  ),
  "Raw Phone shared dump should not appear in Solutions (use Platform view)",
);
assert.ok(
  !solutionsNav.some((i) => i.label === "Create a Phone Menu"),
  "Full Phone solution catalog removed from Solutions view",
);
assert.ok(
  !solutionsNav.some((i) => i.label === "No-Show Recovery"),
  "No-Show Recovery folded into Appointment Reminders",
);

const reports = solutionsNav.find((i) => i.label === "Reports");
const reportLabels = (reports?.children || []).map((c) =>
  "type" in c && c.type === "group" ? c.label : c.label,
);
assert.ok(
  reportLabels.includes("Inquiry Sources"),
  "Inquiry Sources belongs under Reports",
);

const advanced = solutionsNav.find((i) => i.label === "Advanced");
assert.ok(advanced, "Advanced section required");
const advancedLabels = (advanced?.children || []).map((c) =>
  "type" in c && c.type === "group" ? c.label : c.label,
);
assert.deepEqual(
  advancedLabels,
  [
    "Automations",
    "Voice Agents",
    "Knowledge Bases",
    "Testing Lab",
    "Developer Tools",
  ],
  "Advanced should hold builders and technical controls only",
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
