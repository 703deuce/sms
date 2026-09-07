/**
 * Settings coverage proof: config field → UI → API → persistence → runtime → test ID.
 *
 * Run: npx tsx scripts/generate-settings-coverage-proof.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const OUT = join(CERT_DIR, "APPOINTMENTS-MCTB-SETTINGS-COVERAGE.md");

type Row = {
  configField: string;
  domain: string;
  uiControl: string;
  saveApi: string;
  persistence: string;
  runtimeConsumer: string;
  testId: string;
  gap?: string;
};

const rows: Row[] = [
  // AppointmentPlatformConfig (sample — full list in types.ts)
  ...[
    "bookingEnabled",
    "timezone",
    "businessPhone",
    "weeklyHours",
    "dateOverrides",
    "blackoutDates",
    "minimumBookingNoticeMinutes",
    "maximumBookingDaysAhead",
    "bookingProtection.mode",
    "staff[]",
    "locations[]",
    "routingRules[]",
    "bookingLimits",
    "externalCalendarBlocking",
    "reminders.confirmation",
    "reminders.reminder24h",
    "reminders.reminder2h",
    "voiceReminders",
  ].map((f) => ({
    configField: f,
    domain: "AppointmentPlatformConfig",
    uiControl: f.startsWith("reminders") ? "/appointments/reminders" : "/appointments/availability or settings",
    saveApi: "PATCH /api/appointments/settings",
    persistence: "SolutionSetup.configJson",
    runtimeConsumer: "availability engine / reminder-delivery",
    testId: f.startsWith("reminders") ? "APT-AUT-001" : "APT-ENG-001",
  })),

  // MissedCallTextConfig
  ...[
    ["enabled", "/mctb/setup/recovery", "MCTB-RT-005"],
    ["delaySeconds", "/mctb/setup/text-back", "MCTB-SET-004"],
    ["messageTemplate", "/mctb/setup/text-back", "MCTB-SET-004"],
    ["sendAfterNoAnswer", "/mctb/setup/missed-call-rules", "MCTB-SET-002"],
    ["sendAfterBusy", "/mctb/setup/missed-call-rules", "MCTB-SET-002"],
    ["sendAfterRejected", "/mctb/setup/missed-call-rules", "MCTB-SET-002"],
    ["sendAfterTimeout", "/mctb/setup/missed-call-rules", "MCTB-SET-002"],
    ["sendAfterVoicemail", "/mctb/setup/missed-call-rules", "MCTB-SET-002"],
    ["businessHoursOnly", "LEGACY — runtime only", "MCTB-LEGACY-SCHED-001"],
    ["allowedStartTime", "LEGACY — runtime only", "MCTB-LEGACY-SCHED-001"],
    ["allowedEndTime", "LEGACY — runtime only", "MCTB-LEGACY-SCHED-001"],
    ["cooldownMinutes", "/mctb/setup/recovery", "MCTB-RT-006"],
    ["maxMessagesPerCaller", "/mctb/setup/recovery", "MCTB-RT-006"],
    ["suppressOptedOutNumbers", "runtime eligibility", "MCTB-RT-013"],
    ["requestFormEnabled", "MISSING /mctb/setup/links", "MCTB-DEFECT-SETUP-LINKS"],
    ["defaultLinkUrl", "MISSING /mctb/setup/links", "MCTB-DEFECT-SETUP-LINKS"],
    ["requestFormFieldsJson", "MISSING /mctb/setup/links", "MCTB-DEFECT-SETUP-LINKS"],
    ["phoneNumberId", "/mctb/setup/phone", "MCTB-SET-001"],
    ["smsPhoneNumberId", "/mctb/setup/phone", "MCTB-SET-001"],
  ].map(([f, ui, testId]) => ({
    configField: f,
    domain: "MissedCallTextConfig",
    uiControl: ui,
    saveApi: "POST /api/mctb/setup",
    persistence: "missed_call_text_configs",
    runtimeConsumer: "eligibility + send job",
    testId,
    gap: ui.startsWith("MISSING") ? "DEFECT — MISSING UI" : undefined,
  })),

  // MctbHandoffConfig
  ...[
    ["responseMode", "/mctb/setup/notifications", "MCTB-HO-MODE-*"],
    ["emergencyDetectionEnabled", "/mctb/setup/notifications", "MCTB-HO-001"],
    ["emergencyAction", "/mctb/setup/notifications", "MCTB-HO-001"],
    ["bookingBehavior", "/mctb/setup/notifications", "MCTB-HO-001"],
    ["fieldSchemaJson", "/mctb/setup/notifications", "MCTB-HO-FIELD-*"],
    ["routingMatrixJson", "/mctb/setup/notifications", "MCTB-HO-005"],
    ["quietHoursEnabled", "/mctb/setup/notifications", "MCTB-HO-005"],
  ].map(([f, ui, testId]) => ({
    configField: f,
    domain: "MctbHandoffConfig",
    uiControl: ui,
    saveApi: "PATCH /api/mctb/handoff",
    persistence: "mctb_handoff_configs",
    runtimeConsumer: "handoff orchestrator + notifications",
    testId,
  })),

  // NotetakerPlatformConfig
  ...[
    "enabled",
    "joinRule",
    "recordingEnabled",
    "transcriptEnabled",
    "summaryEnabled",
    "actionItemsEnabled",
    "recordingRetentionDays",
    "transcriptRetentionDays",
  ].map((f) => ({
    configField: f,
    domain: "NotetakerPlatformConfig",
    uiControl: "/settings/ai-notetaker",
    saveApi: "settings save",
    persistence: "workspace settings JSON",
    runtimeConsumer: "meeting-assistant/service",
    testId: `AP-NOTETAKER-${f}`,
  })),
];

function main() {
  if (!existsSync(CERT_DIR)) mkdirSync(CERT_DIR, { recursive: true });

  const gaps = rows.filter((r) => r.gap || r.uiControl.includes("MISSING"));

  const md = `# Settings Coverage Proof

**Authority:** Inventory config domains + Prisma models  
**Generated:** ${new Date().toISOString().slice(0, 10)}

## Rule

| Condition | Classification |
|-----------|----------------|
| Config field, no customer UI | Gap (if intended configurable) |
| UI control, no runtime consumer | DEFECT — MISSING RUNTIME |
| Persists but no behavior change | DEFECT — MISSING RUNTIME |
| Legacy field, no canonical UI | Backward-compat test only |

## Gaps flagged

${gaps.length ? gaps.map((g) => `- **${g.configField}** (${g.domain}): ${g.gap ?? g.uiControl} → ${g.testId}`).join("\n") : "_None_"}

## Coverage table

| Config field | Domain | UI control | Save API | Persistence | Runtime consumer | Test ID | Gap |
|--------------|--------|------------|----------|-------------|------------------|---------|-----|
${rows
  .map(
    (r) =>
      `| ${r.configField} | ${r.domain} | ${r.uiControl} | ${r.saveApi} | ${r.persistence} | ${r.runtimeConsumer} | ${r.testId} | ${r.gap ?? ""} |`,
  )
  .join("\n")}
`;

  writeFileSync(OUT, md);
  console.log(`Wrote ${OUT} (${rows.length} rows, ${gaps.length} gaps)`);
}

main();
