#!/usr/bin/env npx tsx
/**
 * Export copy-paste list: every customer-editable wizard control + operational actions,
 * connection status, and what happens on republish for the live agent.
 */
import fs from "node:fs";
import path from "node:path";
import { WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS } from "../src/lib/voice-v3/config/wizard-control-inventory";
import { WIZARD_V3_FIELD_MANIFEST } from "../src/lib/voice-v3/config/wizard-v3-field-manifest";

const manifestByPath = new Map(
  WIZARD_V3_FIELD_MANIFEST.map((row) => [row.statePath, row]),
);

const propagationReportPath =
  process.env.PROPAGATION_REPORT ||
  "/opt/cursor/artifacts/voice-v3-wizard-backend-propagation/report.json";
let propagationOk = false;
try {
  const report = JSON.parse(fs.readFileSync(propagationReportPath, "utf8"));
  propagationOk =
    report.failures?.length === 0 &&
    report.compilerPropagatedCount === report.totalCustomerEditableLeaves;
} catch {
  propagationOk = false;
}

function stepName(step: number): string {
  const names: Record<number, string> = {
    1: "Goals",
    2: "Phone",
    3: "Information",
    4: "Appointments",
    5: "Call Handling",
    6: "Voice",
    7: "Test",
    8: "Activate",
  };
  return names[step] ?? `Step ${step}`;
}

function republishPlainEnglish(
  behavior: string,
  executionStatus: string,
): string {
  if (executionStatus === "CONTROL_PLANE_ONLY") {
    return "Saved on the agent record; does not change LiveKit/GPT-Live call behavior (setup, test, or UI metadata only).";
  }
  if (executionStatus === "CONFIGURED_NOT_IMPLEMENTED") {
    return "Saved and compiled into config, but manifest marks this as not fully executed in runtime yet — republish may not change live call behavior until implemented.";
  }
  if (executionStatus === "INTENTIONALLY_UNSUPPORTED") {
    return "Persisted; intentionally not consumed by Voice V3 runtime.";
  }
  if (behavior === "next_call") {
    return "After Activate: published snapshot updates. Each new inbound call re-loads published config from DB, recompiles VoiceV3AgentConfig, and new LiveKit/GPT-Live sessions use the new value.";
  }
  if (behavior === "active_call_unchanged") {
    return "After Activate: affects subsequent calls; an already-connected call keeps the config it started with.";
  }
  return `Republish behavior: ${behavior}; execution: ${executionStatus}`;
}

function connectedColumns(executionStatus: string): {
  persistence: string;
  compiler: string;
  liveAgentOnRepublish: string;
} {
  const contractPass = propagationOk && executionStatus !== "INTENTIONALLY_UNSUPPORTED";
  const persistence = contractPass ? "YES (contract)" : propagationOk ? "PARTIAL" : "UNVERIFIED";
  const compiler =
    executionStatus === "CONTROL_PLANE_ONLY"
      ? "N/A (control plane)"
      : contractPass
        ? "YES (contract)"
        : "UNVERIFIED";
  let liveAgentOnRepublish = "NO — control plane only";
  if (
    executionStatus === "ACTIVE_EXECUTION" ||
    executionStatus === "LIVE_PROMPT_CONTROL"
  ) {
    liveAgentOnRepublish = contractPass
      ? executionStatus === "LIVE_PROMPT_CONTROL"
        ? "YES — GPT-Live instructions on next new session after Activate"
        : "YES — intended on next new call after Activate"
      : "UNVERIFIED";
  } else if (executionStatus === "ACTIVE_CONTROL_PLANE") {
    liveAgentOnRepublish = contractPass
      ? "YES — ingress/provisioning on next call or activation"
      : "UNVERIFIED";
  } else if (executionStatus === "CONFIGURED_NOT_IMPLEMENTED") {
    liveAgentOnRepublish = "PARTIAL — in published config; runtime may ignore";
  } else if (
    executionStatus === "OUT_OF_SCOPE_RETIRED" ||
    executionStatus === "UI_METADATA_ONLY" ||
    executionStatus === "HIDDEN_STATE_ONLY" ||
    executionStatus === "MCTB_ONLY" ||
    executionStatus === "LEGACY_OBSOLETE"
  ) {
    liveAgentOnRepublish = "NO — not a live Voice V3 runtime control";
  } else if (executionStatus === "FUTURE") {
    liveAgentOnRepublish = "NO — marked future in manifest";
  }
  return { persistence, compiler, liveAgentOnRepublish };
}

type Row = {
  num: number;
  step: string;
  statePath: string;
  uiLabel: string;
  persistence: string;
  compiler: string;
  executionStatus: string;
  runtimeConsumer: string;
  v3ConfigPath: string;
  republishBehavior: string;
  onRepublish: string;
  liveAgentOnRepublish: string;
};

const wizardRows: Row[] = WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.map((statePath, i) => {
  const row = manifestByPath.get(statePath);
  if (!row) {
    return {
      num: i + 1,
      step: "?",
      statePath,
      uiLabel: "(missing manifest row)",
      persistence: "UNKNOWN",
      compiler: "UNKNOWN",
      executionStatus: "UNKNOWN",
      runtimeConsumer: "",
      v3ConfigPath: "",
      republishBehavior: "",
      onRepublish: "",
      liveAgentOnRepublish: "UNKNOWN",
    };
  }
  const conn = connectedColumns(row.executionStatus);
  return {
    num: i + 1,
    statePath,
    step: `${row.step} — ${stepName(row.step)}`,
    uiLabel: row.uiLabel,
    persistence: conn.persistence,
    compiler: conn.compiler,
    executionStatus: row.executionStatus,
    runtimeConsumer: row.runtimeConsumer,
    v3ConfigPath: row.v3ConfigPath,
    republishBehavior: row.republishBehavior,
    onRepublish: republishPlainEnglish(row.republishBehavior, row.executionStatus),
    liveAgentOnRepublish: conn.liveAgentOnRepublish,
  };
});

const operationalRows: Row[] = [
  {
    num: 210,
    step: "3 — Information",
    statePath: "(operational) knowledge-gaps.list",
    uiLabel: "Knowledge gaps — open list",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_API",
    runtimeConsumer: "GET /api/voice/knowledge-gaps",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "Does not change agent config. Updates KB/gap store used for ops and future RAG.",
    liveAgentOnRepublish: "NO — operational data",
  },
  {
    num: 211,
    step: "3 — Information",
    statePath: "(operational) knowledge-gaps.dismiss",
    uiLabel: "Dismiss gap",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_API",
    runtimeConsumer: "PATCH /api/voice/knowledge-gaps",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "Closes gap record; does not require Activate.",
    liveAgentOnRepublish: "NO — operational action",
  },
  {
    num: 212,
    step: "3 — Information",
    statePath: "(operational) knowledge-gaps.resolve",
    uiLabel: "Resolve gap (with answer)",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_API",
    runtimeConsumer: "PATCH /api/voice/knowledge-gaps → may write KB",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "May add approved knowledge; separate from wizard Activate unless KB compile picks it up on next publish.",
    liveAgentOnRepublish: "INDIRECT — KB/RAG refresh path",
  },
  {
    num: 213,
    step: "3 — Information",
    statePath: "(operational) sources.recrawl",
    uiLabel: "Recrawl website",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_API",
    runtimeConsumer: "POST /api/voice/knowledge/crawl",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "Triggers crawl job; vector/RAG may update without wizard field change.",
    liveAgentOnRepublish: "INDIRECT — after crawl + publish if retrieval enabled",
  },
  {
    num: 214,
    step: "3 — Information",
    statePath: "(operational) sources.upload",
    uiLabel: "Upload source document",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_API",
    runtimeConsumer: "POST /api/voice/knowledge/:id/upload",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "Adds source to KB; runtime retrieval may change after indexing.",
    liveAgentOnRepublish: "INDIRECT",
  },
  {
    num: 215,
    step: "5 — Call Handling",
    statePath: "(operational) recent-transfers",
    uiLabel: "Recent transfers table",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_API",
    runtimeConsumer: "GET /api/voice/call-handling/recent-transfers",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "Read-only history; no agent config effect.",
    liveAgentOnRepublish: "NO",
  },
  {
    num: 216,
    step: "5 — Call Handling",
    statePath: "(operational) routing.ingress",
    uiLabel: "Routing / ingress diagnostics",
    persistence: "N/A",
    compiler: "N/A",
    executionStatus: "OPERATIONAL_UI",
    runtimeConsumer: "OpusCallRoutingIngressPanel / Telnyx routing read APIs",
    v3ConfigPath: "N/A",
    republishBehavior: "n/a",
    onRepublish: "Diagnostics only unless panel action changes provisioning (separate from wizard fields).",
    liveAgentOnRepublish: "NO (display)",
  },
];

const all = [...wizardRows, ...operationalRows];

const csvEscape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const csvHeader =
  "num,step,statePath,uiLabel,persistenceConnected,compilerConnected,executionStatus,runtimeConsumer,v3ConfigPath,republishBehavior,liveAgentOnRepublish,onRepublish";
const csvLines = [
  csvHeader,
  ...all.map((r) =>
    [
      r.num,
      r.step,
      r.statePath,
      r.uiLabel,
      r.persistence,
      r.compiler,
      r.executionStatus,
      r.runtimeConsumer,
      r.v3ConfigPath,
      r.republishBehavior,
      r.liveAgentOnRepublish,
      r.onRepublish,
    ]
      .map(csvEscape)
      .join(","),
  ),
];

const mdLines = [
  "# Voice V3 — Eight-step control connection list (copy-paste)",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "**Counts:** 209 wizard manifest leaves + 7 operational rows = **216 rows** (Activate button and wizard Continue/Back are not separate rows here).",
  "",
  "**Connected** columns reflect automated contract certification (`test-voice-v3-wizard-backend-propagation`) when propagation report is present: " +
    (propagationOk ? "**209/209 PASS** at compiler/persist/runtime-contract layer." : "run propagation test and re-export."),
  "",
  "**Not proven by this file:** per-control UI save/reload, or live PSTN behavior on the next call.",
  "",
  "| # | Step | State path | UI label | Persist | Compile | Execution status | Live agent after Activate? | Runtime consumer | On republish |",
  "|---:|------|------------|----------|---------|---------|------------------|----------------------------|------------------|--------------|",
  ...all.map(
    (r) =>
      `| ${r.num} | ${r.step} | \`${r.statePath}\` | ${r.uiLabel.replace(/\|/g, "\\|")} | ${r.persistence} | ${r.compiler} | ${r.executionStatus} | ${r.liveAgentOnRepublish} | ${r.runtimeConsumer.replace(/\|/g, "\\|")} | ${r.onRepublish.replace(/\|/g, "\\|")} |`,
  ),
  "",
  "## Summary by execution status (209 wizard leaves only)",
  "",
];

const summary: Record<string, number> = {};
for (const r of wizardRows) {
  summary[r.executionStatus] = (summary[r.executionStatus] || 0) + 1;
}
for (const [k, v] of Object.entries(summary).sort()) {
  mdLines.push(`- **${k}:** ${v}`);
}

const outMd = path.join(
  process.cwd(),
  "docs/VOICE-V3-EIGHT-STEP-CONTROL-CONNECTION-LIST.md",
);
const outCsv = path.join(
  process.cwd(),
  "docs/VOICE-V3-EIGHT-STEP-CONTROL-CONNECTION-LIST.csv",
);

fs.writeFileSync(outMd, mdLines.join("\n"));
fs.writeFileSync(outCsv, csvLines.join("\n"));
console.log("Wrote", outMd);
console.log("Wrote", outCsv);
console.log("ROWS", all.length);
