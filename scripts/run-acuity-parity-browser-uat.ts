/**
 * Acuity / SimplyBook / Square parity browser UAT (UAT-01..66).
 *
 * Local:
 *   DEV_AUTH_BYPASS=1 BROWSER_CERT_ALLOW_LOCALHOST=1 BROWSER_CERT_PREVIEW_URL=http://localhost:3000 BROWSER_CERT_SKIP_PROVENANCE=1 npm run cert:acuity-parity-browser -- --fresh --continue-on-fail
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BROWSER_CERT_CONFIG } from "./browser-cert/browser-cert.config";
import {
  BrowserPhaseStoppedError,
  runDisposableFlow,
} from "./browser-cert/disposable-browser";
import {
  ACUITY_PARITY_UAT_FLOWS,
  resolveAcuityParityFlows,
} from "./browser-cert/acuity-parity-flows";
import {
  resolveCertBaseUrl,
  ServerGuard,
  setServerGuard,
  TestEnvironmentUnavailableError,
  waitForDeployedApp,
} from "./browser-cert/server-guard";
import {
  authenticate,
  bootstrapCertWorkspaceOnPreview,
  generateResultsMarkdown,
  loadState,
  recordResult,
  saveState,
  type BrowserCertState,
} from "./browser-cert/lib";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const RESULTS_MD = join(CERT_DIR, "ACUITY_PARITY_BROWSER_UAT_RESULTS.md");

process.env.BROWSER_CERT_STATE_FILE = join(CERT_DIR, "acuity-parity-browser-uat-state.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? String(args[onlyIdx + 1]) : null;
  const flowIdx = args.indexOf("--flow");
  const flowId = flowIdx >= 0 ? String(args[flowIdx + 1]) : null;
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
  const fresh = args.includes("--fresh");
  const retest = args.includes("--retest");
  const continueOnFail = args.includes("--continue-on-fail");
  const preflight = args.includes("--preflight");
  return { only, flowId, limit, fresh, retest, continueOnFail, preflight };
}

async function runUat() {
  const { only, flowId, limit, fresh, retest, continueOnFail, preflight } = parseArgs();
  const baseUrl = resolveCertBaseUrl();

  if (preflight) {
    const ok = waitForDeployedApp(baseUrl);
    console.log(ok ? `OK — ${baseUrl} is reachable` : `FAIL — ${baseUrl} not reachable`);
    process.exit(ok ? 0 : 1);
  }

  const skipProvenance =
    process.env.BROWSER_CERT_SKIP_PROVENANCE === "1" ||
    process.env.BROWSER_CERT_SKIP_PROVENANCE?.toLowerCase() === "true";

  if (!skipProvenance) {
    console.warn("WARN: Set BROWSER_CERT_SKIP_PROVENANCE=1 for local UAT");
  }

  console.log("Acuity parity browser UAT (disposable Chromium per flow):");
  console.log(`  URL:    ${baseUrl}`);
  console.log(`  flows:  ${ACUITY_PARITY_UAT_FLOWS.length}`);

  if (!waitForDeployedApp(baseUrl)) {
    console.error(`Application not reachable at ${baseUrl}`);
    process.exit(1);
  }

  const guard = new ServerGuard({
    baseUrl,
    consecutiveFailureLimit: BROWSER_CERT_CONFIG.consecutiveBrowserCrashLimit,
  });
  setServerGuard(guard);

  const startedAt = new Date().toISOString();
  let state: BrowserCertState = fresh
    ? {
        startedAt,
        updatedAt: startedAt,
        baseUrl,
        results: {},
        batchesCompleted: [],
        flowsCompleted: [],
      }
    : loadState();

  state.baseUrl = baseUrl;

  const auth = await authenticate(baseUrl);
  if (!auth.ok) {
    console.error("Login failed — set DEV_AUTH_BYPASS=1 for local testing");
    process.exit(1);
  }
  console.log(`Authenticated as ${auth.email}`);
  await bootstrapCertWorkspaceOnPreview(baseUrl, auth.storageState);

  let flows = resolveAcuityParityFlows({ only, flowId, limit: 0 });
  if (limit > 0) flows = flows.slice(0, limit);

  if (retest) {
    for (const f of flows) {
      delete state.results[f.id];
      state.flowsCompleted = (state.flowsCompleted || []).filter((id) => id !== f.id);
    }
  }

  mkdirSync(join(ROOT, "artifacts/browser-cert/acuity"), { recursive: true });

  for (const flow of flows) {
    console.log(`\n--- ${flow.id}${flow.title ? `: ${flow.title}` : ""} (${flow.batchId}) ---`);
    try {
      guard.assertHealthy(flow.id);
      await runDisposableFlow({
        baseUrl,
        storageState: auth.storageState,
        flow,
        state,
      });
    } catch (err) {
      if (err instanceof TestEnvironmentUnavailableError) {
        recordResult(state, flow.batchId, "ENV", "BLOCKED — TEST ENVIRONMENT UNAVAILABLE", err.message);
        saveState(state);
        process.exit(1);
      }
      if (err instanceof BrowserPhaseStoppedError) {
        saveState(state);
        process.exit(1);
      }
      console.error(`Flow ${flow.id}:`, err);
      if (!continueOnFail) {
        saveState(state);
        throw err;
      }
    }
    saveState(state);
    writeFileSync(RESULTS_MD, generateResultsMarkdown(state));
  }

  writeFileSync(RESULTS_MD, generateResultsMarkdown(state));
  console.log(`\nResults: ${RESULTS_MD}`);

  const results = Object.values(state.results);
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL" || r.status === "TIMEOUT").length;
  const blocked = results.filter((r) => String(r.status).startsWith("BLOCKED")).length;
  console.log(`Summary: ${pass} PASS, ${fail} FAIL, ${blocked} BLOCKED/SKIPPED (of ${results.length} recorded)`);
  if (fail) process.exitCode = 1;
}

runUat()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => setServerGuard(null));
