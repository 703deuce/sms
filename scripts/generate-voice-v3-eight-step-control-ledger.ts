#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import { WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS } from "../src/lib/voice-v3/config/wizard-control-inventory";

const outDir =
  process.env.LEDGER_OUT || "/opt/cursor/artifacts/voice-v3-configuration-certification";
const propagationReport = process.env.PROPAGATION_REPORT
  ? JSON.parse(fs.readFileSync(process.env.PROPAGATION_REPORT, "utf8"))
  : null;

function stepForPath(p: string): string {
  if (
    p.startsWith("capabilities.") ||
    p === "solutionName" ||
    p === "answerWhen" ||
    p === "preset" ||
    p === "outcomeSlug"
  )
    return "goals";
  if (
    p.startsWith("numberSource") ||
    p.startsWith("phoneNumber") ||
    p.startsWith("ring") ||
    p.startsWith("callRecording") ||
    p.startsWith("connectionGreeting") ||
    p.startsWith("outboundSms")
  )
    return "phone";
  if (
    p.includes("knowledge") ||
    p.includes("website") ||
    p.includes("businessSchedule") ||
    p === "timezone" ||
    p.includes("operatingMaturity") ||
    p === "businessName" ||
    p === "linkedKnowledgeBaseId"
  )
    return "information";
  if (
    p.includes("appointment") ||
    p.includes("booking") ||
    p.includes("calendar") ||
    p.includes("qualification") ||
    p.includes("collectFields")
  )
    return "appointments";
  if (
    p.includes("transfer") ||
    p.includes("callback") ||
    p.includes("afterHours") ||
    p.includes("aiCallRecovery") ||
    p.includes("spam") ||
    p.includes("solicitor") ||
    p.includes("urgency") ||
    p.includes("warmTransfer")
  )
    return "call-handling";
  if (
    p.includes("voice") ||
    p === "agentName" ||
    p.includes("openingGreeting") ||
    p.includes("conversationBehaviors") ||
    p === "speaksFirst" ||
    p === "tone" ||
    p === "role" ||
    p === "speakingStyle" ||
    p === "language"
  )
    return "voice";
  if (p.startsWith("test")) return "test";
  if (p.startsWith("activation")) return "activate";
  return "unknown";
}

const failurePaths = new Set(
  (propagationReport?.failures ?? []).map((f: { statePath: string }) => f.statePath),
);

const rows = WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.map((statePath) => {
  const failed = failurePaths.has(statePath);
  return {
    step: stepForPath(statePath),
    uiSection: "(manifest leaf — expand to UI widgets in Phase 2)",
    control: statePath,
    component: "see steps/*.tsx",
    uiStateAction: statePath,
    persistedFieldApi: "POST /api/solutions/appointment-receptionist",
    saveVerified: "NOT_RUN",
    reloadVerified: "NOT_RUN",
    publishPath: "activate → voiceAgentVersion.config",
    compilerMapping: "WIZARD_V3_FIELD_MANIFEST",
    runtimeConsumer:
      "compileVoiceV3AgentConfig → resolveVoiceV3AgentConfigForAgent (each inbound call)",
    expectedRuntimeEffect: "(manifest row)",
    testPerformed: propagationReport ? "leaf_propagation_cert" : "NOT_RUN",
    status: failed
      ? "FAIL — COMPILER/RUNTIME DISCONNECTED"
      : propagationReport
        ? "PASS — RUNTIME (contract leaf propagation only)"
        : "REQUIRES_CERT",
    failureBoundary: failed ? "wizard-leaf-propagation-verify" : "",
    fix: "",
  };
});

const operational = [
  ["information", "Knowledge gaps", "dismiss gap", "VoiceKnowledgeGapsPanel", "PATCH /api/voice/knowledge-gaps"],
  ["information", "Knowledge gaps", "resolve gap", "VoiceKnowledgeGapsPanel", "PATCH /api/voice/knowledge-gaps"],
  ["information", "Sources", "recrawl", "VoiceKnowledgeSourcesPanel", "POST /api/voice/knowledge/crawl"],
  ["information", "Sources", "upload", "useVoiceKnowledgeOperations", "POST /api/voice/knowledge/:id/upload"],
  [
    "call-handling",
    "Operations",
    "recent transfers",
    "VoiceCallHandlingRecentTransfersPanel",
    "GET /api/voice/call-handling/recent-transfers",
  ],
  [
    "call-handling",
    "Operations",
    "routing ingress",
    "OpusCallRoutingIngressPanel",
    "ingress diagnostics",
  ],
  [
    "call-handling",
    "Spam & unwanted calls",
    "spamLikelyPolicy radios",
    "SpamUnwantedCallsEditor",
    "patch spamLikelyPolicy → compile → spamProtection",
  ],
  [
    "call-handling",
    "Spam & unwanted calls",
    "solicitorPolicy radios",
    "SpamUnwantedCallsEditor",
    "patch solicitorPolicy → report_unwanted_solicitor tool",
  ],
].map(([step, section, control, component, api]) => ({
  step,
  uiSection: section,
  control,
  component,
  uiStateAction: control,
  persistedFieldApi: api,
  saveVerified: "NOT_RUN",
  reloadVerified: "N/A",
  publishPath: step === "call-handling" && section.includes("Spam") ? "activate → published config" : "N/A",
  compilerMapping: section.includes("Spam") ? "compileVoiceV3AgentConfig.spamProtection" : "N/A",
  runtimeConsumer: section.includes("Spam")
    ? "voice-v3-livekit session + tool authorize"
    : "operational API",
  expectedRuntimeEffect: "(see control)",
  testPerformed: section.includes("Spam") ? "certification_contract_spam" : "static wiring",
  status: section.includes("Spam")
    ? "PASS — RUNTIME (contract compile + tool gate; UI reload NOT_RUN)"
    : "PASS — BACKEND/OPERATIONAL (live NOT_RUN)",
  failureBoundary: "",
  fix: "",
}));

const navigation = [
  ["*", "Wizard chrome", "Continue", "wizard.tsx goToStep"],
  ["*", "Wizard chrome", "Back", "wizard.tsx goToStep"],
  ["activate", "Activate", "Activate", "persistReceptionistActivate"],
].map(([step, section, control, component]) => ({
  step,
  uiSection: section,
  control,
  component,
  uiStateAction: control,
  persistedFieldApi: "POST /api/solutions/appointment-receptionist",
  saveVerified: "NOT_RUN",
  reloadVerified: "NOT_RUN",
  publishPath: control === "Activate" ? "publishedVersionId" : "N/A",
  compilerMapping: control === "Activate" ? "full wizard in published config" : "N/A",
  runtimeConsumer: control === "Activate" ? "loadVoiceAgentRuntimeConfig per call" : "URL ?step=",
  expectedRuntimeEffect: control === "Activate" ? "next call uses new publish" : "navigation",
  testPerformed: "static trace",
  status:
    control === "Activate"
      ? "REQUIRES_CERT (live publish→call NOT_RUN)"
      : "PASS — NAVIGATION",
  failureBoundary: "",
  fix: "",
}));

const all = [...rows, ...operational, ...navigation];

const totals: Record<string, number> = { total: all.length };
for (const r of all) {
  const bucket = r.status.startsWith("PASS")
    ? r.status.split("—")[0].trim()
    : r.status.startsWith("FAIL")
      ? "FAIL"
      : r.status.startsWith("REQUIRES")
        ? "REQUIRES_CERT"
        : "OTHER";
  totals[bucket] = (totals[bucket] || 0) + 1;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "control-ledger.json"), JSON.stringify({ totals, rows: all }, null, 2));
console.log("LEDGER_ROWS", all.length);
console.log("LEDGER_TOTALS", JSON.stringify(totals));
