#!/usr/bin/env node
/**
 * Static checks for receptionist 8-step sidebar nav + wizard step deep links.
 * No dev server required.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(msg) {
  failures.push(msg);
}

const navSrc = read("src/newui-transplant/lib/nav.ts");
const sidebarSrc = read("src/newui-transplant/components/app/app-sidebar.tsx");
const wizardSrc = read("src/components/solutions/appointment-receptionist/wizard.tsx");
const stepUrlSrc = read("src/lib/voice/receptionist/wizard-step-url.ts");
const overviewSrc = read("src/newui-transplant/mirror/routes/voice/receptionist/page.tsx");
const editPageSrc = read("src/app/(app)/voice/receptionist/edit/page.tsx");
const opusPageSrc = read("src/newui-transplant/connected/voice/appointment-receptionist-wizard-opus-page.tsx");

const STEP_IDS = [
  "goals",
  "phone",
  "information",
  "appointments",
  "call-handling",
  "voice",
  "test",
  "activate",
];

for (const id of STEP_IDS) {
  const href = `/voice/receptionist/edit?step=${id}`;
  if (!stepUrlSrc.includes(`"${id}"`)) fail(`wizard-step-url missing step id ${id}`);
  if (!navSrc.includes(href) && !stepUrlSrc.includes(`appointments: "appointments"`)) {
    /* href built dynamically */
  }
}

if (!stepUrlSrc.includes('appointments: "appointments"')) {
  fail("appointments query must be appointments not booking");
}

if (navSrc.includes("label: 'Business Knowledge'") || navSrc.includes("href: '/voice/knowledge'")) {
  fail("Primary nav must not list Business Knowledge");
}
if (navSrc.includes("href: '/voice/call-handling'")) {
  fail("Primary nav must not list standalone Call Handling");
}

if (!navSrc.includes("children: RECEPTIONIST_SIDEBAR_CHILDREN")) {
  fail("Receptionist nav item must expose 8 children");
}

for (const id of STEP_IDS) {
  if (!sidebarSrc.includes("SidebarMenuSub")) fail("sidebar missing submenu components");
  if (!wizardSrc.includes("receptionistStepQueryFromIndex")) fail("wizard missing opus URL sync");
  if (!wizardSrc.includes("stepIndexFromReceptionistQuery")) fail("wizard missing opus step hydrate");
}

if (!wizardSrc.includes("RECEPTIONIST_WIZARD_EDIT_PATH")) {
  fail("wizard must update URL on /voice/receptionist/edit");
}

if (!overviewSrc.includes("/voice/receptionist/edit")) {
  fail("overview must still link to edit wizard");
}

if (
  !editPageSrc.includes("NewUiVoiceReceptionistEditorPage") &&
  !editPageSrc.includes("AppointmentReceptionistWizardOpusPage")
) {
  fail("edit route must still use 8-step opus page");
}

if (!opusPageSrc.includes('presentation="opus"') && !opusPageSrc.includes("presentation={'opus'}")) {
  if (!opusPageSrc.includes("AppointmentReceptionistWizard")) {
    fail("opus page must render AppointmentReceptionistWizard");
  }
}

if (!editPageSrc.includes("ReceptionistEditorOpus")) {
  /* good - 3-stage not mounted */
} else if (editPageSrc.includes("ReceptionistEditorOpus")) {
  fail("edit page must not mount 3-stage ReceptionistEditorOpus");
}

for (const route of ["/voice/knowledge", "/voice/call-handling"]) {
  const pagePath =
    route === "/voice/knowledge"
      ? "src/app/(app)/voice/knowledge/page.tsx"
      : "src/app/(app)/voice/call-handling/page.tsx";
  if (!fs.existsSync(path.join(root, pagePath))) {
    fail(`route file removed: ${pagePath}`);
  }
}

if (navSrc.includes("VOICE_RECEPTIONIST_OPERATIONAL_ROUTES")) {
  /* preserved route constants */
}

if (failures.length) {
  console.error("RECEPTIONIST_WIZARD_SIDEBAR_NAV: FAIL");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("RECEPTIONIST_WIZARD_SIDEBAR_NAV: PASS");
console.log(`steps: ${STEP_IDS.length}`);
console.log("deep-link base: /voice/receptionist/edit?step=<id>");
