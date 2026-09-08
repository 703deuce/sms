#!/usr/bin/env npx tsx
/**
 * Audit browser-cert flows: classify reachability vs user-action vs backend/static.
 * Cross-references last run results to show how many PASS were real user journeys.
 *
 * Usage: npm run cert:audit-browser-flow-classification
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_FLOWS, REACHABILITY_FLOWS } from "./browser-cert/flows";
import { USER_ACTION_FLOWS } from "./browser-cert/behavioral-flows";
import { classifyFlow, FLOW_CLASSIFICATION, type FlowClassification } from "./browser-cert/flow-classification";
import { loadState } from "./browser-cert/lib";

const OUT_MD = join(process.cwd(), "docs/certification/BROWSER_FLOW_CLASSIFICATION_AUDIT.md");
const OUT_JSON = join(process.cwd(), "docs/certification/browser-flow-classification.json");

type Row = {
  id: string;
  batchId: string;
  classification: FlowClassification;
  tier: string;
  customerOperable: boolean;
  needsUserActionFlow: boolean;
  userActionFlowId?: string;
  lastStatus?: string;
  notes?: string;
};

function main() {
  const state = loadState();
  const rows: Row[] = [];

  for (const flow of REACHABILITY_FLOWS) {
    const meta = classifyFlow(flow.id, Boolean(flow.static));
    rows.push({
      id: flow.id,
      batchId: flow.batchId,
      classification: meta.classification,
      tier: flow.static ? "static" : flow.tier ?? "reachability",
      customerOperable: meta.customerOperable,
      needsUserActionFlow: meta.needsUserActionFlow,
      userActionFlowId: meta.userActionFlowId,
      lastStatus: state.results[flow.id]?.status,
      notes: meta.notes,
    });
  }

  for (const flow of USER_ACTION_FLOWS) {
    rows.push({
      id: flow.id,
      batchId: flow.batchId,
      classification: "TRUE_USER_ACTION",
      tier: "user-action",
      customerOperable: true,
      needsUserActionFlow: false,
      lastStatus: state.results[flow.id]?.status,
      notes: flow.title,
    });
  }

  const byClass: Record<FlowClassification, number> = {
    TRUE_USER_ACTION: 0,
    ROUTE_RENDER: 0,
    BACKEND_STATIC: 0,
  };
  for (const r of rows) byClass[r.classification]++;

  const baselineRows = rows.filter((r) => !r.id.startsWith("UA-"));
  const baselineByClass: Record<FlowClassification, number> = {
    TRUE_USER_ACTION: 0,
    ROUTE_RENDER: 0,
    BACKEND_STATIC: 0,
  };
  for (const r of baselineRows) baselineByClass[r.classification]++;

  const passRows = rows.filter((r) => r.lastStatus === "PASS");
  const passByClass: Record<FlowClassification, number> = {
    TRUE_USER_ACTION: 0,
    ROUTE_RENDER: 0,
    BACKEND_STATIC: 0,
  };
  for (const r of passRows) passByClass[r.classification]++;

  const customerOperable = rows.filter((r) => r.customerOperable);
  const needsUa = customerOperable.filter((r) => r.needsUserActionFlow);
  const hasUaPlanned = new Set(
    [...needsUa.map((r) => r.userActionFlowId).filter(Boolean), ...USER_ACTION_FLOWS.map((f) => f.id)],
  );
  const uaImplemented = new Set(USER_ACTION_FLOWS.map((f) => f.id));
  const uaMissing = [...hasUaPlanned].filter((id) => id && !uaImplemented.has(id));

  const unmapped = REACHABILITY_FLOWS.filter((f) => !FLOW_CLASSIFICATION[f.id]).map((f) => f.id);

  const md = [
    "# Browser Flow Classification Audit",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    `**Baseline reachability flows:** ${REACHABILITY_FLOWS.length}`,
    `**User-action flows (BATCH-UA):** ${USER_ACTION_FLOWS.length}`,
    `**Total flows:** ${ALL_FLOWS.length}`,
    "",
    "## Executive summary",
    "",
    "The prior **170 PASS** result was **not** 170 full customer journeys. It was mostly route/render checks and backend-static passes recorded without browser interaction.",
    "",
    "### Classification counts (baseline 189)",
    "",
    "| Classification | Count | Meaning |",
    "|----------------|-------|---------|",
    `| ROUTE/RENDER CHECK ONLY | ${baselineByClass.ROUTE_RENDER} | Page loads, redirects, shell, control-exists — **not sufficient alone** for customer-operable features |`,
    `| BACKEND/STATIC ONLY | ${baselineByClass.BACKEND_STATIC} | No browser; backend/script certification |`,
    `| TRUE USER-ACTION FLOW | ${baselineByClass.TRUE_USER_ACTION} | Baseline had none; BATCH-UA adds ${USER_ACTION_FLOWS.length} |`,
    "",
    "### Last run PASS breakdown (from state file)",
    "",
    "| Classification | PASS count |",
    "|----------------|------------|",
    `| ROUTE/RENDER | ${passByClass.ROUTE_RENDER} |`,
    `| BACKEND/STATIC | ${passByClass.BACKEND_STATIC} |`,
    `| TRUE USER-ACTION | ${passByClass.TRUE_USER_ACTION} |`,
    `| **Total PASS** | **${passRows.length}** |`,
    "",
    `**True user-journey PASS in last run: ${passByClass.TRUE_USER_ACTION}** (target: all customer-operable features)`,
    "",
    "### Customer-operable coverage gap",
    "",
    `- Customer-operable features in baseline: **${customerOperable.length}**`,
    `- Need companion user-action flow: **${needsUa.length}**`,
    `- User-action flows implemented (BATCH-UA): **${USER_ACTION_FLOWS.length}**`,
    `- Planned UA flow IDs not yet implemented: **${uaMissing.length}**`,
    "",
    "## Required interaction standard",
    "",
    "See `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md`.",
    "",
    "PASS for a customer-operable feature requires **both**:",
    "",
    "1. Reachability flow PASS (page reachable)",
    "2. User-action flow PASS (click → type → submit → verify → refresh → persist)",
    "",
    "## Full inventory",
    "",
    "| ID | Batch | Classification | Tier | Customer operable | Needs UA | UA flow | Last status | Notes |",
    "|----|-------|----------------|------|-------------------|----------|---------|-------------|-------|",
    ...rows
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        (r) =>
          `| ${r.id} | ${r.batchId} | ${r.classification} | ${r.tier} | ${r.customerOperable ? "yes" : "no"} | ${r.needsUserActionFlow ? "yes" : "no"} | ${r.userActionFlowId ?? "—"} | ${r.lastStatus ?? "—"} | ${(r.notes ?? "").replace(/\|/g, "/")} |`,
      ),
    "",
  ];

  if (unmapped.length) {
    md.push("## Unmapped flows (needs classification entry)", "", unmapped.map((id) => `- ${id}`).join("\n"), "");
  }

  if (uaMissing.length) {
    md.push(
      "## Planned user-action flows not yet implemented",
      "",
      uaMissing.map((id) => `- ${id}`).join("\n"),
      "",
    );
  }

  writeFileSync(OUT_MD, md.join("\n"));
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totals: {
          baseline: REACHABILITY_FLOWS.length,
          userAction: USER_ACTION_FLOWS.length,
          all: ALL_FLOWS.length,
        },
        byClassification: byClass,
        passByClassification: passByClass,
        customerOperable: customerOperable.length,
        needsUserActionFlow: needsUa.length,
        userActionImplemented: USER_ACTION_FLOWS.length,
        userActionMissing: uaMissing,
        rows,
      },
      null,
      2,
    ),
  );

  console.log("Browser flow classification audit");
  console.log(`  Baseline flows:     ${REACHABILITY_FLOWS.length}`);
  console.log(`  User-action flows:  ${USER_ACTION_FLOWS.length}`);
  console.log(`  ROUTE/RENDER:       ${byClass.ROUTE_RENDER}`);
  console.log(`  BACKEND/STATIC:     ${byClass.BACKEND_STATIC}`);
  console.log(`  TRUE USER-ACTION:   ${USER_ACTION_FLOWS.length} (BATCH-UA; baseline had 0)`);
  console.log(`  Last run PASS:      ${passRows.length}`);
  console.log(`  PASS user-action:   ${passByClass.TRUE_USER_ACTION}`);
  console.log(`  PASS route/render:  ${passByClass.ROUTE_RENDER}`);
  console.log(`  PASS backend/static:${passByClass.BACKEND_STATIC}`);
  console.log(`  Wrote: ${OUT_MD}`);
}

main();
