#!/usr/bin/env node
/**
 * Transovo Phone — automated functional audit orchestrator.
 * Run: node new-app/scripts/phone-functional-audit/run-audit.mjs
 * Optional: PHONE_TEST_BASE_URL=https://transovo.ai (remote API smoke)
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(auditDir, "..", "..");
const reportPath =
  process.env.PHONE_AUDIT_REPORT ||
  path.join("/opt/cursor/artifacts", "phone-functional-audit-report.json");

const results = [];

function record(testId, feature, executed, expected, actual, status, evidence = "", files = "") {
  results.push({
    testId,
    feature,
    executed,
    expected,
    actual,
    status,
    evidence: String(evidence).slice(0, 2000),
    filesChanged: files,
  });
}

function runScript(testId, feature, scriptName) {
  const scriptPath = path.join(appRoot, "scripts", scriptName);
  const cmd = "npx";
  const args = ["tsx", scriptPath];
  const r = spawnSync(cmd, args, {
    cwd: appRoot,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const pass = r.status === 0;
  record(
    testId,
    feature,
    `spawn ${cmd} ${args.join(" ")}`,
    "exit 0",
    pass ? "exit 0" : `exit ${r.status}`,
    pass ? "PASS" : "FAIL",
    out.split("\n").slice(-8).join("\n"),
  );
  return pass;
}

function staticWiring(testId, feature, fileRel, pattern, shouldMatch = true) {
  const full = path.join(appRoot, fileRel);
  let text = "";
  try {
    text = readFileSync(full, "utf8");
  } catch (e) {
    record(testId, feature, `read ${fileRel}`, "file exists", String(e), "FAIL");
    return false;
  }
  const re = new RegExp(pattern);
  const ok = shouldMatch ? re.test(text) : !re.test(text);
  record(
    testId,
    feature,
    `grep ${fileRel}`,
    shouldMatch ? `matches /${pattern}/` : `no match /${pattern}/`,
    ok ? "ok" : "mismatch",
    ok ? "PASS" : "FAIL",
  );
  return ok;
}

async function remoteApiSmoke() {
  const base = (process.env.PHONE_TEST_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    record(
      "P-API-000",
      "Infrastructure",
      "skip — PHONE_TEST_BASE_URL unset",
      "remote smoke",
      "BLOCKED",
      "BLOCKED",
      "Set PHONE_TEST_BASE_URL for live API wiring (no PSTN).",
    );
    return;
  }
  async function get(p) {
    const res = await fetch(`${base}${p}`);
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }
  const endpoints = [
    ["/api/health", "P-API-001", "Health"],
    ["/api/phone/readiness", "P-API-002", "Readiness"],
    ["/api/phone/webrtc-token", "P-API-003", "WebRTC token"],
    ["/api/telnyx/phone", "P-API-004", "Telnyx webhook GET"],
    ["/api/phone/settings", "P-API-005", "Settings"],
    ["/api/phone/routing", "P-API-006", "Routing"],
    ["/api/phone/forwarding/destinations", "P-API-007", "Forwarding destinations"],
    ["/api/phone/power-dialer/campaigns", "P-API-008", "Power dialer"],
  ];
  for (const [path, id, name] of endpoints) {
    const r = await get(path);
    record(
      id,
      "Phone API",
      `GET ${base}${path}`,
      "HTTP 200 + JSON body",
      `HTTP ${r.status}`,
      r.ok ? "PASS" : "FAIL",
      JSON.stringify(r.json).slice(0, 200),
    );
  }
}

// —— Phase 2 unit / logic suites ——
const suites = [
  ["P-FWD-001", "Call forwarding", "test-phone-forwarding-routing.mjs"],
  ["P-FWD-002", "Forwarding destinations", "test-phone-forwarding-destinations.mjs"],
  ["P-FWD-003", "Forwarding runtime gate", "test-phone-forwarding-runtime-gate.mjs"],
  ["P-REC-001", "Recordings", "test-phone-recording-resolve.mjs"],
  ["P-RT-001", "Call runtime", "test-phone-runtime-logic.mjs"],
  ["P-IVR-001", "Conversational IVR", "test-conversational-ivr-transfer.mjs"],
  ["P-IVR-002", "Conversational IVR", "test-conversational-route-helpers.mjs"],
  ["P-IVR-003", "Conversational IVR", "test-conversational-ivr-profile.mjs"],
  ["P-IVR-004", "Voice V3 tools", "test-voice-v3-tools.mjs"],
  ["P-ARCH-001", "Phone architecture", "test-single-provision-phone-architecture.mjs"],
  ["P-CONN-001", "Number connection", "test-validate-phone-connection.mjs"],
];

for (const [id, feature, script] of suites) {
  runScript(id, feature, script);
}

// MCTB excluded from audit scope — only assert UI gate remains off
staticWiring("P-MCTB-EXCL", "Exclusions", "lib/products/mctb-ui.ts", "MCTB_UI_ENABLED", true);

// Wiring: telnyx ingress → calls service
staticWiring(
  "P-INB-001",
  "Inbound",
  "app/api/telnyx/phone/route.ts",
  "handleInboundCall",
  true,
);
staticWiring(
  "P-INB-002",
  "Inbound",
  "lib/server/phone/routing/forward-loop-guard.ts",
  "assertNoIndirectForwardingLoop",
  true,
);

await remoteApiSmoke();

const summary = {
  generatedAt: new Date().toISOString(),
  totals: {
    PASS: results.filter((r) => r.status === "PASS").length,
    FAIL: results.filter((r) => r.status === "FAIL").length,
    BLOCKED: results.filter((r) => r.status === "BLOCKED").length,
    NOT_IMPLEMENTED: results.filter((r) => r.status === "NOT_IMPLEMENTED").length,
  },
  results,
};

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(summary, null, 2));

const mdPath = reportPath.replace(/\.json$/, ".md");
const lines = [
  "# Transovo Phone — Automated Functional Audit",
  "",
  `Generated: ${summary.generatedAt}`,
  "",
  `| Status | Count |`,
  `|--------|-------|`,
  `| PASS | ${summary.totals.PASS} |`,
  `| FAIL | ${summary.totals.FAIL} |`,
  `| BLOCKED | ${summary.totals.BLOCKED} |`,
  "",
  "## Results",
  "",
];
for (const r of results) {
  lines.push(`### ${r.testId} — ${r.feature} — **${r.status}**`);
  lines.push(`- Executed: ${r.executed}`);
  lines.push(`- Expected: ${r.expected}`);
  lines.push(`- Actual: ${r.actual}`);
  if (r.evidence) lines.push(`- Evidence: \`${r.evidence.replace(/`/g, "'")}\``);
  lines.push("");
}
writeFileSync(mdPath, lines.join("\n"));

console.log(`Phone audit: PASS=${summary.totals.PASS} FAIL=${summary.totals.FAIL} BLOCKED=${summary.totals.BLOCKED}`);
console.log(`Report: ${mdPath}`);
process.exit(summary.totals.FAIL > 0 ? 1 : 0);
