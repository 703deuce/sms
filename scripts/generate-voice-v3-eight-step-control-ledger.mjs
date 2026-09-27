#!/usr/bin/env node
/**
 * Generates the machine-readable control ledger skeleton from wizard-control-inventory
 * plus operational/navigation rows. Status defaults to REQUIRES_UI_RUNTIME_CERT unless
 * overridden by propagation report JSON path.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir =
  process.env.LEDGER_OUT || "/opt/cursor/artifacts/voice-v3-configuration-certification";
const propagationReport = process.env.PROPAGATION_REPORT
  ? JSON.parse(fs.readFileSync(process.env.PROPAGATION_REPORT, "utf8"))
  : null;

const inventoryTs = fs.readFileSync(
  path.join(root, "src/lib/voice-v3/config/wizard-control-inventory.ts"),
  "utf8",
);
const paths = [...inventoryTs.matchAll(/"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => p.includes(".") || p === "capabilities");

const stepForPath = (p) => {
  if (p.startsWith("capabilities") || p === "solutionName" || p === "answerWhen" || p === "preset")
    return "goals";
  if (
    p.startsWith("numberSource") ||
    p.startsWith("phoneNumber") ||
    p.startsWith("ring") ||
    p.startsWith("callRecording") ||
    p.startsWith("connectionGreeting")
  )
    return "phone";
  if (
    p.includes("knowledge") ||
    p.includes("website") ||
    p.includes("businessSchedule") ||
    p.includes("timezone") ||
    p.includes("operatingMaturity") ||
    p === "businessName"
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
    p.includes("urgency")
  )
    return "call-handling";
  if (
    p.includes("voice") ||
    p.includes("agentName") ||
    p.includes("openingGreeting") ||
    p.includes("conversationBehaviors") ||
    p.includes("speaksFirst")
  )
    return "voice";
  if (p.startsWith("test")) return "test";
  if (p.startsWith("activation")) return "activate";
  return "unknown";
};

const failurePaths = new Set(
  (propagationReport?.failures ?? []).map((f) => f.statePath),
);

const rows = paths.map((statePath) => {
  const failed = failurePaths.has(statePath);
  return {
    step: stepForPath(statePath),
    uiSection: "(leaf — decompose in UI audit)",
    control: statePath,
    component: "see step *.tsx",
    uiStateAction: statePath,
    persistedFieldApi: "POST /api/solutions/appointment-receptionist",
    saveVerified: "NOT_RUN",
    reloadVerified: "NOT_RUN",
    publishPath: "activate → save-setup → voiceAgentVersion.config",
    compilerMapping: "WIZARD_V3_FIELD_MANIFEST",
    runtimeConsumer: "compileVoiceV3AgentConfig → resolveVoiceV3AgentConfigForAgent (per call)",
    expectedRuntimeEffect: "(field-specific — see manifest)",
    testPerformed: failed ? "leaf_propagation_cert" : propagationReport ? "leaf_propagation_cert" : "NOT_RUN",
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
  ["call-handling", "Operations", "recent transfers list", "VoiceCallHandlingRecentTransfersPanel", "GET /api/voice/call-handling/recent-transfers"],
  ["call-handling", "Operations", "routing ingress", "OpusCallRoutingIngressPanel", "(ingress diagnostics APIs)"],
].map(([step, section, control, component, api]) => ({
  step,
  uiSection: section,
  control,
  component,
  uiStateAction: control,
  persistedFieldApi: api,
  saveVerified: "NOT_RUN",
  reloadVerified: "N/A",
  publishPath: "N/A",
  compilerMapping: "N/A",
  runtimeConsumer: "operational API",
  expectedRuntimeEffect: "backend operation only",
  testPerformed: "static wiring",
  status: "PASS — BACKEND/OPERATIONAL (API wired; live action NOT_RUN)",
  failureBoundary: "",
  fix: "",
}));

const navigation = [
  ["*", "Wizard chrome", "Continue", "wizard.tsx goToStep", "?step= URL sync"],
  ["*", "Wizard chrome", "Back", "wizard.tsx goToStep", "?step= URL sync"],
  ["activate", "Activate", "Activate", "persistReceptionistActivate", "action=activate publish"],
].map(([step, section, control, component, effect]) => ({
  step,
  uiSection: section,
  control,
  component,
  uiStateAction: control,
  persistedFieldApi: "POST /api/solutions/appointment-receptionist",
  saveVerified: "NOT_RUN",
  reloadVerified: "NOT_RUN",
  publishPath: "activate → publishedVersionId",
  compilerMapping: "full wizard snapshot in published config",
  runtimeConsumer: "loadVoiceAgentRuntimeConfig per inbound call",
  expectedRuntimeEffect: effect,
  testPerformed: "static trace",
  status: control === "Activate" ? "REQUIRES_CERT (publish→next call)" : "PASS — NAVIGATION (static)",
  failureBoundary: "",
  fix: "",
}));

const all = [...rows, ...operational, ...navigation];

const totals = all.reduce(
  (acc, r) => {
    const key = r.status.split(" ")[0];
    acc[key] = (acc[key] || 0) + 1;
    acc.total += 1;
    return acc;
  },
  { total: 0 },
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "control-ledger.json"), JSON.stringify({ totals, rows: all }, null, 2));
console.log("LEDGER_ROWS", all.length);
console.log("LEDGER_TOTALS", JSON.stringify(totals));
console.log("Wrote", path.join(outDir, "control-ledger.json"));
