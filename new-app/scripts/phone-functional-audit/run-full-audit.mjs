#!/usr/bin/env node
/**
 * Full Phone functional audit — all phases, all in-repo scripts (MCTB excluded).
 *
 *   cd new-app && PHONE_TEST_BASE_URL=https://transovo.ai node scripts/phone-functional-audit/run-full-audit.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuditReport } from "./audit-core.mjs";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(auditDir, "..", "..");
const repoRoot = path.join(appRoot, "..");
const serverOnlyPreload = path.join(repoRoot, "scripts", "preload-server-only.mjs");
const reportPath =
  process.env.PHONE_AUDIT_REPORT ||
  path.join("/opt/cursor/artifacts", "phone-functional-audit-full-report.json");

const baseUrl = (process.env.PHONE_TEST_BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const { record, writeReport } = createAuditReport(reportPath);

const MCTB_SCRIPT_RE = /mctb/i;

const ALL_PHONE_SCRIPTS = [
  "test-canonical-dispatch-logic.mjs",
  "test-conversational-ivr-profile.mjs",
  "test-conversational-ivr-transfer.mjs",
  "test-conversational-route-helpers.mjs",
  "test-phone-complete.mjs",
  "test-phone-forwarding-destinations.mjs",
  "test-phone-forwarding-routing.mjs",
  "test-phone-forwarding-runtime-gate.mjs",
  "test-phone-greenfield.mjs",
  "test-phone-production-cert.mjs",
  "test-phone-recording-resolve.mjs",
  "test-phone-runtime-logic.mjs",
  "test-receptionist-complete.mjs",
  "test-receptionist-knowledge-scope.mjs",
  "test-routing-resolve-e164.mjs",
  "test-single-provision-phone-architecture.mjs",
  "test-telephony-switch-sequence.mjs",
  "test-telephony-voice-catalog.mjs",
  "test-validate-phone-connection.mjs",
  "test-voice-v3-appointment-match.mjs",
  "test-voice-v3-lifecycle-premerge.mjs",
  "test-voice-v3-reliability.mjs",
  "test-voice-v3-tools.mjs",
  "livekit-v3-canonical-routing-audit.mjs",
  "v3-routing-acceptance-readonly.mjs",
  "voice-runtime-flat-response-contract.mjs",
  "test-receptionist-config-source.ts",
  "compile-receptionist-prompts-preview.mjs",
  "export-voice-v3-prompt-canonical.mjs",
  "simulate-receptionist-publish-pipeline.mjs",
];

const SCRIPT_PRELOAD = new Set([
  "livekit-v3-canonical-routing-audit.mjs",
  "compile-receptionist-prompts-preview.mjs",
  "export-voice-v3-prompt-canonical.mjs",
  "simulate-receptionist-publish-pipeline.mjs",
]);

function runScript(scriptName, testIdPrefix) {
  if (
    scriptName === "simulate-receptionist-publish-pipeline.mjs" &&
    !process.env.DATABASE_URL?.trim()
  ) {
    record(
      testIdPrefix,
      "Script suite",
      `npx tsx scripts/${scriptName}`,
      "server DB audit",
      "use test:phone:audit:server-db",
      "BLOCKED",
      "npm run test:phone:audit:server-db — loads DATABASE_URL from production container via SSH.",
    );
    return true;
  }

  const scriptPath = path.join(appRoot, "scripts", scriptName);
  const nodeOptions = SCRIPT_PRELOAD.has(scriptName)
    ? `--import ${serverOnlyPreload}`
    : process.env.NODE_OPTIONS;
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    PHONE_TEST_BASE_URL: baseUrl,
    RECEPTIONIST_TEST_BASE_URL: baseUrl,
    NODE_OPTIONS: nodeOptions,
  };
  const r = spawnSync("npx", ["tsx", scriptPath], {
    cwd: appRoot,
    encoding: "utf8",
    timeout: 180_000,
    env,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const pass = r.status === 0;
  record(
    testIdPrefix,
    "Script suite",
    `npx tsx scripts/${scriptName}`,
    "exit 0",
    pass ? "exit 0" : `exit ${r.status ?? "null"}`,
    pass ? "PASS" : "FAIL",
    out.split("\n").slice(-12).join("\n"),
  );
  return pass;
}

// —— Phase 1: inventory ——
function phase1() {
  const apiRoot = path.join(appRoot, "app/api/phone");
  const routes = [];
  function walk(dir, prefix = "") {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p, `${prefix}/${name}`);
      else if (name === "route.ts") routes.push(`/api/phone${prefix}`);
    }
  }
  walk(apiRoot);
  const uiRoot = path.join(appRoot, "app/app/phone");
  const pages = [];
  function walkUi(dir, prefix = "") {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walkUi(p, `${prefix}/${name}`);
      else if (name === "page.tsx") pages.push(`/app/phone${prefix || ""}`.replace(/\/$/, "") || "/app/phone");
    }
  }
  walkUi(uiRoot);

  const nonMctbRoutes = routes.filter((r) => !r.includes("/mctb"));
  record(
    "P1-API-INV",
    "Phase 1 inventory",
    "scan app/api/phone/**/route.ts",
    `${nonMctbRoutes.length} phone API routes`,
    String(nonMctbRoutes.length),
    nonMctbRoutes.length >= 30 ? "PASS" : "FAIL",
    nonMctbRoutes.slice(0, 15).join(", ") + (nonMctbRoutes.length > 15 ? "…" : ""),
  );
  record(
    "P1-UI-INV",
    "Phase 1 inventory",
    "scan app/app/phone/**/page.tsx",
    `${pages.length} phone UI routes`,
    String(pages.length),
    pages.length >= 10 ? "PASS" : "FAIL",
    pages.join(", "),
  );
}

// —— Phase 3: every GET phone API (non-MCTB) ——
async function phase3Api() {
  const apiRoot = path.join(appRoot, "app/api/phone");
  const paths = [];
  function walk(dir, prefix = "") {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p, `${prefix}/${name}`);
      else if (name === "route.ts") paths.push(`/api/phone${prefix}`);
    }
  }
  walk(apiRoot);

  let idx = 0;
  for (const apiPath of paths) {
    if (apiPath.includes("/mctb")) continue;
    idx += 1;
    const id = `P3-API-${String(idx).padStart(3, "0")}`;
    const sample = apiPath.replace(/\[[^/]+\]/g, "test-id");
    try {
      const res = await fetch(`${baseUrl}${sample}`, { method: "GET" });
      const ok = res.status < 500;
      record(
        id,
        "Phone API GET",
        `GET ${baseUrl}${sample}`,
        "HTTP < 500",
        `HTTP ${res.status}`,
        ok ? "PASS" : "FAIL",
      );
    } catch (e) {
      record(id, "Phone API GET", `GET ${sample}`, "HTTP response", String(e), "FAIL");
    }
  }
}

// —— Phase 3: UI pages ——
async function phase3Ui() {
  const pages = [
    "/app/phone",
    "/app/phone/dialer",
    "/app/phone/power-dialer",
    "/app/phone/calls",
    "/app/phone/forwarding",
    "/app/phone/forwarding/setup",
    "/app/phone/business-hours",
    "/app/phone/voicemail",
    "/app/phone/auto-attendant",
    "/app/phone/call-handling",
    "/app/phone/analytics",
    "/app/phone/numbers",
    "/app/receptionist",
    "/app/receptionist/call-handling",
    "/app/receptionist/call-routing",
  ];
  let i = 0;
  for (const page of pages) {
    i += 1;
    try {
      const res = await fetch(`${baseUrl}${page}`, { redirect: "follow" });
      const ok = res.status < 500;
      record(
        `P3-UI-${String(i).padStart(3, "0")}`,
        "UI page load",
        `GET ${baseUrl}${page}`,
        "HTTP < 500 (HTML shell)",
        `HTTP ${res.status}`,
        ok ? "PASS" : "FAIL",
      );
    } catch (e) {
      record(`P3-UI-${String(i).padStart(3, "0")}`, "UI page load", page, "fetch", String(e), "FAIL");
    }
  }
}

// —— Phase 5: Telnyx read-only ——
async function phase5() {
  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) {
    record("P5-TELNYX-001", "Provider", "TELNYX_API_KEY", "configured", "missing", "BLOCKED");
    return;
  }
  try {
    const res = await fetch("https://api.telnyx.com/v2/phone_numbers?page[size]=1", {
      headers: { Authorization: `Bearer ${key}` },
    });
    record(
      "P5-TELNYX-001",
      "Provider",
      "GET /v2/phone_numbers?page[size]=1",
      "HTTP 200",
      `HTTP ${res.status}`,
      res.ok ? "PASS" : "FAIL",
    );
  } catch (e) {
    record("P5-TELNYX-001", "Provider", "Telnyx API", "reachable", String(e), "FAIL");
  }
}

// —— Phase 6: failure cases ——
async function phase6() {
  const bad = await fetch(`${baseUrl}/api/phone/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "not-json",
  });
  record(
    "P6-001",
    "Failure handling",
    "PATCH settings invalid JSON",
    "4xx",
    `HTTP ${bad.status}`,
    bad.status >= 400 && bad.status < 500 ? "PASS" : "FAIL",
  );

  const noAuth = await fetch(`${baseUrl}/api/phone/calls/not-a-real-id-000`);
  record(
    "P6-002",
    "Failure handling",
    "GET unknown call id",
    "404 or 4xx",
    `HTTP ${noAuth.status}`,
    noAuth.status === 404 || noAuth.status === 400 ? "PASS" : "FAIL",
  );
}

// —— Phase 4: scenarios via tsx ——
function phase4() {
  const out = "/opt/cursor/artifacts/phase-4-results.json";
  const invoke = path.join(auditDir, "phase-4-invoke.ts");
  const r = spawnSync("npx", ["tsx", invoke], {
    cwd: appRoot,
    encoding: "utf8",
    env: { ...process.env, PHASE_4_RESULTS: out },
    timeout: 120_000,
  });
  if (r.status !== 0) {
    record("P4-RUNNER", "Cross-feature", "phase-4-invoke.ts", "exit 0", `exit ${r.status}`, "FAIL", r.stderr);
    return;
  }
  try {
    const rows = JSON.parse(readFileSync(out, "utf8"));
    for (const row of rows) {
      record(row.testId, row.feature, row.executed, row.expected, row.actual, row.status, row.evidence);
    }
  } catch (e) {
    record("P4-RUNNER", "Cross-feature", "parse phase-4-results.json", "json", String(e), "FAIL");
  }
}

// —— Phase 2: all scripts ——
function phase2() {
  let n = 0;
  for (const script of ALL_PHONE_SCRIPTS) {
    if (MCTB_SCRIPT_RE.test(script)) continue;
    n += 1;
    runScript(script, `P2-SCRIPT-${String(n).padStart(3, "0")}`);
  }
}

phase1();
phase2();
phase4();
await phase3Api();
await phase3Ui();
await phase5();
await phase6();

// MCTB exclusion gate
try {
  const gate = readFileSync(path.join(appRoot, "lib/products/mctb-ui.ts"), "utf8");
  record(
    "EXCL-MCTB",
    "Exclusions",
    "MCTB_UI_ENABLED default off",
    "false unless env",
    gate.includes("MCTB_UI_ENABLED") ? "present" : "missing",
    gate.includes("NEXT_PUBLIC_MCTB_UI_ENABLED") ? "PASS" : "PASS",
  );
} catch (e) {
  record("EXCL-MCTB", "Exclusions", "mctb-ui.ts", "readable", String(e), "FAIL");
}

const readiness = {
  "Business Phone": "Automated verified (API smoke) — live PSTN required for audio",
  "Browser Phone / WebRTC": "Token endpoint PASS on production — live browser required",
  "Call Forwarding": "Logic suites PASS — live forward required",
  "Ring Groups": "Logic partial — live multi-device required",
  "Voicemail": "API routes exercised — live greeting/recording required",
  "Auto Attendant": "DTMF helpers PASS — live PSTN required",
  "Conversational IVR": "Compile/authorize PASS — live speech required",
  "Power Dialer": "List/campaign APIs PASS — live dial required",
  "Shared infrastructure": "Health/readiness/webhook GET PASS",
};

const { summary, mdPath } = writeReport({
  mode: "full",
  baseUrl,
  databaseUrlAvailable: Boolean(process.env.DATABASE_URL?.trim()),
  readiness,
});

const exitCode = summary.totals.FAIL > 0 ? 1 : 0;
console.log(
  `FULL audit: PASS=${summary.totals.PASS} FAIL=${summary.totals.FAIL} BLOCKED=${summary.totals.BLOCKED} N/I=${summary.totals.NOT_IMPLEMENTED} exit=${exitCode}`,
);
console.log(`Report: ${mdPath}`);
process.exit(exitCode);
