#!/usr/bin/env node
/**
 * Static checks: Information / Call Handling operational sub-views inside wizard.
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

const required = [
  "src/lib/voice/receptionist/wizard-step-subview.ts",
  "src/newui-transplant/connected/voice/information-step-opus-operations.tsx",
  "src/newui-transplant/connected/voice/call-handling-step-opus-operations.tsx",
  "src/newui-transplant/connected/voice/knowledge-operations-panels.tsx",
  "src/newui-transplant/connected/voice/call-handling-operations-panels.tsx",
  "src/newui-transplant/connected/voice/use-voice-knowledge-operations.ts",
];

for (const f of required) {
  if (!fs.existsSync(path.join(root, f))) fail(`missing ${f}`);
}

const infoStep = read("src/components/solutions/appointment-receptionist/steps/information-step.tsx");
const chStep = read("src/components/solutions/appointment-receptionist/steps/call-handling-step.tsx");
const knowledgePage = read("src/newui-transplant/connected/voice/knowledge-page.tsx");
const subview = read("src/lib/voice/receptionist/wizard-step-subview.ts");
const nav = read("src/newui-transplant/lib/nav.ts");

if (!infoStep.includes("InformationStepOpusOperations")) {
  fail("information-step must use opus operations shell");
}
if (!chStep.includes("CallHandlingStepOpusOperations")) {
  fail("call-handling-step must use opus operations shell");
}
if (!subview.includes("gaps") || !subview.includes("sources")) {
  fail("information subviews missing");
}
if (!subview.includes("transfers") || !subview.includes("routing")) {
  fail("call-handling subviews missing");
}
if (knowledgePage.includes('router.push("/voice/setup")')) {
  fail("knowledge page must not route edit hours to MCTB /voice/setup");
}
if (!knowledgePage.includes('buildReceptionistEditHref')) {
  fail("knowledge page must use receptionist edit href for hours");
}
if (!infoStep.includes("knowledge-gaps") && !read("src/newui-transplant/connected/voice/knowledge-operations-panels.tsx").includes("VoiceKnowledgeGapsPanel")) {
  fail("gaps panel missing");
}
if (!read("src/newui-transplant/connected/voice/call-handling-operations-panels.tsx").includes("OpusCallRoutingIngressPanel")) {
  fail("routing panel must reuse OpusCallRoutingIngressPanel");
}
if (!read("src/newui-transplant/connected/voice/call-handling-operations-panels.tsx").includes("recent-transfers")) {
  fail("recent transfers API must be used");
}
if (nav.includes("href: '/voice/knowledge'")) {
  fail("sidebar must not restore standalone knowledge link");
}
if (nav.includes("children: RECEPTIONIST_SIDEBAR_CHILDREN")) {
  /* ok */
} else {
  fail("receptionist sidebar children must remain");
}

if (failures.length) {
  console.error("RECEPTIONIST_WIZARD_OPERATIONAL_VIEWS: FAIL");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("RECEPTIONIST_WIZARD_OPERATIONAL_VIEWS: PASS");
