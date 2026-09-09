/**
 * Master Appointments browser UAT — real user journeys on transovo.ai (harbor-home).
 *
 *   $env:BROWSER_CERT_SKIP_PROVENANCE="1"
 *   npm run cert:appointments-master-browser -- --section A --fresh --continue-on-fail
 *
 * Auth defaults: alex@harborhome.co / demo1234 (override with MASTER_UAT_EMAIL/PASSWORD).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, BrowserContext, Page } from "playwright";
import { BROWSER_CERT_CONFIG } from "./browser-cert/browser-cert.config";
import {
  catalogTestCount,
  IMPLEMENTED_SECTION_IDS,
  plannedTestCount,
  resolveMasterUatFlows,
  type MasterUatFlow,
  type MasterUatStatus,
} from "./browser-cert/appointments-master-uat-catalog";
import { DISPOSABLE_PAUSE_MS } from "./browser-cert/disposable-browser";
import { authenticateMasterUat } from "./browser-cert/master-uat-auth";
import { MASTER_UAT_FLOW_TIMEOUT_MS, MASTER_UAT_SLUG } from "./browser-cert/master-uat-config";
import {
  attachConsoleCapture,
  failureScreenshot,
  launchBrowser,
  withFlowTimeout,
} from "./browser-cert/lib";
import {
  resolveCertBaseUrl,
  ServerGuard,
  setServerGuard,
  TestEnvironmentUnavailableError,
  waitForDeployedApp,
} from "./browser-cert/server-guard";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const STATE_FILE = join(CERT_DIR, "appointments-master-browser-uat-state.json");
const RESULTS_MD = join(CERT_DIR, "APPOINTMENTS-MASTER-BROWSER-UAT-RESULTS.md");
const ARTIFACTS = join(ROOT, "artifacts/browser-cert/master-uat");

export type MasterUatResult = {
  id: string;
  section: string;
  title: string;
  status: MasterUatStatus;
  detail: string;
  at: string;
};

export type MasterUatState = {
  startedAt: string;
  updatedAt: string;
  baseUrl: string;
  workspaceSlug: string;
  method: string;
  results: Record<string, MasterUatResult>;
  summary: Record<string, number>;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const sectionIdx = args.indexOf("--section");
  let section = sectionIdx >= 0 ? String(args[sectionIdx + 1]) : "A";
  const testIdx = args.indexOf("--test");
  let testId = testIdx >= 0 ? String(args[testIdx + 1]) : null;
  // npm on Windows sometimes drops flags — accept positional `A 2`
  if (sectionIdx < 0 && args[0] && !args[0].startsWith("-")) {
    section = args[0];
    if (args[1] && !args[1].startsWith("-")) testId = args[1];
  }
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
  const fresh = args.includes("--fresh");
  const retest = args.includes("--retest");
  const continueOnFail = args.includes("--continue-on-fail");
  const preflight = args.includes("--preflight");
  const all = args.includes("--all") || section.toUpperCase() === "ALL";
  return { section: all ? "ALL" : section, testId, limit, fresh, retest, continueOnFail, preflight, all };
}

function loadMasterState(): MasterUatState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as MasterUatState;
  }
  const now = new Date().toISOString();
  return {
    startedAt: now,
    updatedAt: now,
    baseUrl: "",
    workspaceSlug: "harbor-home",
    method: "playwright-disposable",
    results: {},
    summary: {},
  };
}

function recomputeSummary(state: MasterUatState) {
  const summary: Record<string, number> = {
    BROWSER_PASS: 0,
    LIVE_PASS: 0,
    FAIL: 0,
    PROVIDER_BLOCKED: 0,
    NOT_APPLICABLE: 0,
    NOT_RUN: 0,
  };
  for (const r of Object.values(state.results)) {
    summary[r.status] = (summary[r.status] || 0) + 1;
  }
  const done = Object.keys(state.results).length;
  summary.NOT_RUN = Math.max(0, plannedTestCount() - done);
  state.summary = summary;
}

function recordMasterResult(state: MasterUatState, flow: MasterUatFlow, status: MasterUatStatus, detail: string) {
  state.results[flow.id] = {
    id: flow.id,
    section: flow.section,
    title: flow.title,
    status,
    detail: detail.slice(0, 500),
    at: new Date().toISOString(),
  };
  recomputeSummary(state);
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function generateMasterMarkdown(state: MasterUatState): string {
  recomputeSummary(state);
  const lines = [
    "# Appointments Master Real-User Browser UAT",
    "",
    `**Updated:** ${state.updatedAt}`,
    `**Environment:** \`${state.baseUrl}\``,
    `**Test workspace slug:** \`${state.workspaceSlug}\``,
    `**Method:** ${state.method}`,
    "",
    "## Certification rule",
    "",
    "A row receives **`BROWSER_PASS`** only when the full real-user workflow completes in the browser.",
    "",
    "## Executive summary",
    "",
    "| Status | Count |",
    "|--------|-------|",
    ...Object.entries(state.summary).map(([s, n]) => `| ${s} | ${n} |`),
    "",
    "## Results (all tests)",
    "",
    "| ID | Section | Title | Status | Detail |",
    "|----|---------|-------|--------|--------|",
  ];

  const sorted = Object.values(state.results).sort((a, b) => Number(a.id) - Number(b.id));
  for (const r of sorted) {
    const detail = r.detail.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${r.id} | ${r.section} | ${r.title} | **${r.status}** | ${detail} |`);
  }

  lines.push("", "---", "", `State file: \`docs/certification/appointments-master-browser-uat-state.json\``);
  return lines.join("\n");
}

async function runMasterFlow(
  baseUrl: string,
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>,
  flow: MasterUatFlow,
  state: MasterUatState,
): Promise<void> {
  if (flow.static) {
    recordMasterResult(state, flow, flow.static.status, flow.static.detail);
    console.log(`  → ${flow.static.status}: ${flow.static.detail.slice(0, 80)}`);
    return;
  }

  if (!flow.run) {
    recordMasterResult(state, flow, "FAIL", "No run() implementation");
    return;
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      storageState,
    });
    page = await context.newPage();
    attachConsoleCapture(page);

    await withFlowTimeout(flow.id, MASTER_UAT_FLOW_TIMEOUT_MS, () => flow.run!(page));
    recordMasterResult(state, flow, "BROWSER_PASS", "Full user journey completed in browser");
    console.log("  → BROWSER_PASS");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (page) await failureScreenshot(page, `MASTER-${flow.id}`);
    recordMasterResult(state, flow, "FAIL", msg.slice(0, 500));
    console.log(`  → FAIL: ${msg.slice(0, 120)}`);
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => setTimeout(r, DISPOSABLE_PAUSE_MS));
  }
}

async function main() {
  const { section, testId, limit, fresh, retest, continueOnFail, preflight, all } = parseArgs();
  const baseUrl = resolveCertBaseUrl();

  if (preflight) {
    const ok = waitForDeployedApp(baseUrl);
    console.log(ok ? `OK — ${baseUrl}` : `FAIL — ${baseUrl} not reachable`);
    process.exit(ok ? 0 : 1);
  }

  console.log("Appointments master browser UAT (real user journeys):");
  console.log(`  URL:       ${baseUrl}`);
  console.log(`  workspace: ${MASTER_UAT_SLUG}`);
  console.log(`  section:   ${section} (implemented: ${IMPLEMENTED_SECTION_IDS.join(", ")})`);
  console.log(`  catalog:   ${catalogTestCount()} journeys / ${plannedTestCount()} planned tests`);

  if (!waitForDeployedApp(baseUrl)) {
    console.error(`Application not reachable at ${baseUrl}`);
    process.exit(1);
  }

  const guard = new ServerGuard({
    baseUrl,
    consecutiveFailureLimit: BROWSER_CERT_CONFIG.consecutiveBrowserCrashLimit,
  });
  setServerGuard(guard);

  let state = fresh ? loadMasterState() : loadMasterState();
  if (fresh) {
    state.results = {};
    state.startedAt = new Date().toISOString();
  }
  state.baseUrl = baseUrl;
  state.workspaceSlug = MASTER_UAT_SLUG;
  state.method = "playwright-master-uat-journeys";

  const auth = await authenticateMasterUat(baseUrl);
  if (!auth.ok) {
    console.error(
      "Login failed — set MASTER_UAT_EMAIL + MASTER_UAT_PASSWORD (default alex@harborhome.co / demo1234)",
    );
    process.exit(1);
  }
  console.log(`Authenticated as ${auth.email}`);

  const skipCompletedIds = new Set<string>();
  if (!retest && !fresh) {
    for (const [id, r] of Object.entries(state.results)) {
      if (r.status !== "NOT_RUN") skipCompletedIds.add(id);
    }
  }

  let flows = resolveMasterUatFlows({
    section: all ? "ALL" : section,
    testId,
    limit: 0,
    skipCompletedIds: skipCompletedIds.size ? skipCompletedIds : undefined,
  });
  if (limit > 0) flows = flows.slice(0, limit);

  if (retest) {
    for (const f of flows) delete state.results[f.id];
  }

  if (skipCompletedIds.size && !retest && !fresh) {
    console.log(`  skipping:  ${skipCompletedIds.size} tests already recorded (use --retest to re-run)`);
  }
  console.log(`  running:   ${flows.length} journeys`);

  mkdirSync(ARTIFACTS, { recursive: true });

  for (const flow of flows) {
    console.log(`\n--- Test ${flow.id} [${flow.section}]: ${flow.title} ---`);
    try {
      guard.assertHealthy(flow.id);
      await runMasterFlow(baseUrl, auth.storageState, flow, state);
    } catch (err) {
      if (err instanceof TestEnvironmentUnavailableError) {
        recordMasterResult(state, flow, "FAIL", err.message);
        saveAndExit(state, 1);
      }
      console.error(err);
      if (!continueOnFail) {
        writeFileSync(RESULTS_MD, generateMasterMarkdown(state));
        process.exit(1);
      }
    }
    writeFileSync(RESULTS_MD, generateMasterMarkdown(state));
  }

  writeFileSync(RESULTS_MD, generateMasterMarkdown(state));
  recomputeSummary(state);
  console.log("\n=== Master UAT batch complete ===");
  console.log(state.summary);
  console.log(`Results: ${RESULTS_MD}`);

  if ((state.summary.FAIL || 0) > 0) process.exitCode = 1;
}

function saveAndExit(state: MasterUatState, code: number) {
  writeFileSync(RESULTS_MD, generateMasterMarkdown(state));
  process.exit(code);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => setServerGuard(null));
