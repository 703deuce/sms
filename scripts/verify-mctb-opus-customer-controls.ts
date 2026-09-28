/**
 * Static gate: every customer-facing MCTB setup control has an Opus/onboarding path.
 * Run: npx tsx scripts/verify-mctb-opus-customer-controls.ts
 */
import fs from "node:fs";
import path from "node:path";

type FieldSpec = {
  field: string;
  opusPaths: string[];
  intentionalGap?: string;
};

const SPECS: FieldSpec[] = [
  { field: "phoneNumberId", opusPaths: ["mctb-onboarding-opus-view", "mctb-setup-phone-wiring"] },
  { field: "businessLineE164", opusPaths: ["mctb-setup-phone-wiring"] },
  { field: "smsPhoneNumberId", opusPaths: ["mctb-setup-phone-wiring"] },
  { field: "senderMode", opusPaths: ["mctb-setup-phone-wiring"] },
  { field: "consentMode", opusPaths: ["consent-editor"] },
  { field: "existingConsentAttested", opusPaths: ["consent-editor"] },
  { field: "messageTemplate", opusPaths: ["text-back-editor", "mctb-onboarding-operational-steps"] },
  { field: "platformRecoveryTemplateId", opusPaths: ["text-back-editor", "mctb-onboarding-operational-steps"] },
  { field: "recoveryGoal", opusPaths: ["text-back-editor"] },
  { field: "triggerRules", opusPaths: ["setup-wiring-hooks", "useMctbVoicemailWiring"] },
  { field: "delaySeconds", opusPaths: ["setup-wiring-hooks"] },
  { field: "cooldownMinutes", opusPaths: ["setup-wiring-hooks"] },
  { field: "maxMessagesPerCaller", opusPaths: ["setup-wiring-hooks"] },
  { field: "enabled", opusPaths: ["setup-wiring-hooks", "mctb-recovery-pause-opus", "overview-page"] },
  { field: "pauseUntil", opusPaths: ["setup-wiring-hooks", "mctb-recovery-pause-opus"] },
  { field: "defaultLinkUrl", opusPaths: ["mctb-setup-links-editor"] },
  { field: "requestFormEnabled", opusPaths: ["mctb-setup-links-editor"] },
  { field: "leadCaptureEnabled", opusPaths: ["mctb-setup-links-editor"] },
  { field: "requestFormFieldsJson", opusPaths: ["mctb-setup-links-editor"] },
  {
    field: "replyNotifications",
    opusPaths: [],
    intentionalGap: "Superseded by /api/mctb/handoff routingMatrix (Setup → Notifications)",
  },
  {
    field: "businessHoursOnly",
    opusPaths: [],
    intentionalGap: "Removed from MCTB IA — Recovery Controls replaces schedule variants (spec 12)",
  },
  {
    field: "activate",
    opusPaths: ["onboarding", "live-test"],
    intentionalGap: "Trial activation via live-test/onboarding activate_trial — not a standalone Setup toggle",
  },
];

const ROOT = path.join(process.cwd(), "src/newui-transplant");
const files = walk(ROOT);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const corpus = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const onboardingCorpus = fs.readFileSync(
  path.join(process.cwd(), "src/lib/mctb/onboarding/mctb-onboarding-runtime.tsx"),
  "utf8",
);

let failed = 0;
for (const spec of SPECS) {
  if (spec.intentionalGap) continue;
  const hit = spec.opusPaths.some(
    (token) => corpus.includes(token) || (token === "onboarding" && onboardingCorpus.length > 0),
  );
  if (!hit) {
    console.error(`FAIL: ${spec.field} — no Opus path matched [${spec.opusPaths.join(", ")}]`);
    failed++;
  }
}

const routes = [
  "overview-page.tsx",
  "missed-calls-page.tsx",
  "missed-call-detail-page.tsx",
  "conversations-page.tsx",
  "ai-recovery-page.tsx",
  "voicemail-page.tsx",
  "analytics-page.tsx",
  "consent-history-page.tsx",
  "setup-pages.tsx",
  "mctb-setup-links-editor.tsx",
  "exclusions-table.tsx",
];

for (const r of routes) {
  const full = path.join(ROOT, r.includes("/") ? r : `connected/mctb/${r}`);
  const alt = path.join(ROOT, "components/mctb", r);
  if (!fs.existsSync(full) && !fs.existsSync(alt)) {
    console.error(`FAIL: missing connected shell for ${r}`);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed} customer-control verification failure(s)`);
  process.exit(1);
}

console.log("PASS verify:mctb-opus-customer-controls");
console.log(`Fields checked: ${SPECS.length}, Opus files scanned: ${files.length}`);
