/**
 * Appointments + MCTB front-end browser certification runner.
 *
 * DISPOSABLE-BROWSER MODE: one headless Chromium per flow, fully killed between flows.
 * HARD RULE: preview/staging URL only — never local next dev.
 *
 * Usage:
 *   CERT_BROWSER_PASSWORD=... npm run cert:appointments-mctb-browser -- --only BATCH-01
 *
 * Preview URL and timeouts: scripts/browser-cert/browser-cert.config.ts
 * Deploy SHA: auto-read from preview /api/health vs local git HEAD
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_FLOWS, BATCHES, CERT_GROUP_FLOWS, REACHABILITY_FLOWS, resolveFlows } from "./browser-cert/flows";
import { CERT_GROUP_MANIFEST } from "./browser-cert/cert-groups/manifest";
import { BROWSER_CERT_CONFIG } from "./browser-cert/browser-cert.config";
import { writeProvenance } from "./browser-cert/provenance";
import {
  BrowserPhaseStoppedError,
  runDisposableFlow,
} from "./browser-cert/disposable-browser";
import {
  resolveCertBaseUrl,
  ServerGuard,
  setServerGuard,
  TestEnvironmentUnavailableError,
  verifyDeployProvenance,
  waitForDeployedApp,
} from "./browser-cert/server-guard";
import {
  authenticate,
  browserCertPreflight,
  generateResultsMarkdown,
  loadState,
  reconcileStateProvenance,
  recordResult,
  RESULTS_MD,
  saveState,
  type BrowserCertState,
} from "./browser-cert/lib";

const ROOT = join(import.meta.dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  const from = fromIdx >= 0 ? Number(args[fromIdx + 1]) : 1;
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? String(args[onlyIdx + 1]) : null;
  const flowIdx = args.indexOf("--flow");
  const flowId = flowIdx >= 0 ? String(args[flowIdx + 1]) : null;
  const fresh = args.includes("--fresh");
  const retest = args.includes("--retest");
  const seed = args.includes("--seed");
  const continueOnFail = args.includes("--continue-on-fail");
  const preflight = args.includes("--preflight");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
  const certIdx = args.indexOf("--cert");
  const certGroup = certIdx >= 0 ? String(args[certIdx + 1]) : null;
  return { from, only, flowId, certGroup, fresh, retest, seed, continueOnFail, preflight, limit };
}

function markEnvironmentBlocked(state: BrowserCertState, batchId: string, reason: string) {
  state.environmentBlocked = true;
  state.environmentBlockedReason = reason;
  recordResult(state, batchId, "ENV-UNAVAILABLE", "BLOCKED — TEST ENVIRONMENT UNAVAILABLE", reason);
  saveState(state);
}

function markBrowserPhaseStopped(state: BrowserCertState, flowId: string, reason: string) {
  state.browserPhaseBlocked = true;
  state.browserPhaseBlockedReason = reason;
  state.lastUnfinishedFlowId = flowId;
  recordResult(state, "BROWSER", flowId, "BLOCKED — BROWSER PHASE STOPPED", reason);
  saveState(state);
}

function syncBatchCheckpoints(state: BrowserCertState) {
  const completed = new Set(state.flowsCompleted || []);
  state.batchesCompleted = BATCHES.filter((b) =>
    ALL_FLOWS.filter((f) => f.batchId === b.id).every((f) => completed.has(f.id)),
  ).map((b) => b.id);
}

async function runDisposableCert() {
  const { from, only, flowId, certGroup, fresh, retest, seed, continueOnFail, preflight, limit } = parseArgs();

  if (preflight) {
    const r = await browserCertPreflight();
    console.log(r.message);
    process.exit(r.ok ? 0 : 1);
  }

  let baseUrl: string;
  let provenance: ReturnType<typeof verifyDeployProvenance>;
  try {
    baseUrl = resolveCertBaseUrl();
    provenance = verifyDeployProvenance(baseUrl);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  writeProvenance({
    recordedAt: startedAt,
    certificationStartedAt: startedAt,
    baseUrl,
    gitCommitSha: provenance.gitCommitSha,
    deployCommitSha: provenance.deployCommitSha,
    provenanceVerified: provenance.provenanceOk,
  });

  console.log("Disposable-browser certification:");
  console.log(`  base URL:   ${baseUrl}`);
  console.log(`  git SHA:    ${provenance.gitCommitSha}`);
  console.log(`  deploy SHA: ${provenance.deployCommitSha}`);
  console.log(`  flows:      ${ALL_FLOWS.length} total (${REACHABILITY_FLOWS.length} reachability + ${CERT_GROUP_FLOWS.length} cert groups)`);
  console.log(`  mode:       one Chromium per flow`);

  if (!waitForDeployedApp(baseUrl)) {
    console.error(`Deployed application not reachable at ${baseUrl}`);
    process.exit(1);
  }

  if (seed || fresh) {
    console.log("\nSeeding cert workspace (appointment types, MCTB fixtures)…");
    const { spawnSync } = await import("node:child_process");
    const seedResult = spawnSync(
      "npm",
      ["run", "seed:appointments-mctb-browser-cert"],
      { stdio: "inherit", env: process.env, shell: true },
    );
    if (seedResult.status !== 0) {
      console.error("Cert workspace seed failed — fix DATABASE_URL and retry");
      process.exit(1);
    }
  }

  const guard = new ServerGuard({
    baseUrl,
    consecutiveFailureLimit: BROWSER_CERT_CONFIG.consecutiveServerFailureLimit,
  });
  setServerGuard(guard);

  let state: BrowserCertState = fresh
    ? {
        startedAt,
        updatedAt: startedAt,
        baseUrl,
        provenance: {
          gitCommitSha: provenance.gitCommitSha,
          deployCommitSha: provenance.deployCommitSha,
          provenanceVerified: true,
        },
        results: {},
        batchesCompleted: [],
        flowsCompleted: [],
      }
    : loadState();

  state.baseUrl = baseUrl;
  state.provenance = {
    gitCommitSha: provenance.gitCommitSha,
    deployCommitSha: provenance.deployCommitSha,
    provenanceVerified: true,
  };
  state.flowsCompleted = state.flowsCompleted || [];

  const reconcile = reconcileStateProvenance(state, baseUrl, provenance.deployCommitSha);
  if (reconcile.cleared > 0) {
    console.log(`\nProvenance reconcile: cleared ${reconcile.cleared} stale results.`);
    state.flowsCompleted = [];
    state.batchesCompleted = [];
    state.browserPhaseBlocked = false;
    state.browserPhaseBlockedReason = undefined;
    state.consecutiveBrowserCrashes = 0;
    saveState(state);
  }

  if (state.browserPhaseBlocked) {
    console.error(
      `\nBrowser phase stopped at ${state.lastUnfinishedFlowId}: ${state.browserPhaseBlockedReason}`,
    );
    console.error("Clear browserPhaseBlocked in state or use --fresh after fixing the environment.");
    process.exit(1);
  }

  const auth = await authenticate(baseUrl);
  if (!auth.ok) {
    console.error(
      "Authentication failed — set CERT_BROWSER_PASSWORD (secret) for the cert account on preview",
    );
    process.exit(1);
  }
  console.log(`Authenticated as ${auth.email}`);

  let flows = resolveFlows({ only: certGroup ?? only, from, flowId, retest });
  if (certGroup && flows.length === 0) {
    console.error(`Unknown --cert group: ${certGroup}`);
    console.error(`Valid cert IDs: ${CERT_GROUP_MANIFEST.map((g) => g.id).join(", ")}`);
    process.exit(1);
  }
  if (only && flows.length === 0) {
    console.error(`Unknown --only target: ${only}`);
    process.exit(1);
  }

  if (retest) {
    const ids = new Set(flows.map((f) => f.id));
    for (const id of ids) {
      delete state.results[id];
      state.flowsCompleted = (state.flowsCompleted || []).filter((x) => x !== id);
    }
  }

  let ran = 0;
  for (const flow of flows) {
    if (limit > 0 && ran >= limit) break;

    const done = state.flowsCompleted?.includes(flow.id);
    const passed = state.results[flow.id]?.status === "PASS";
    if (done && passed && !retest && !fresh) {
      continue;
    }

    console.log(`\n--- Flow ${flow.id} (${flow.batchId}) — disposable browser ---`);
    try {
      guard.assertHealthy(flow.id);
      await runDisposableFlow({
        baseUrl,
        storageState: auth.storageState,
        flow,
        state,
      });
      ran += 1;
    } catch (err) {
      if (err instanceof TestEnvironmentUnavailableError) {
        markEnvironmentBlocked(state, flow.batchId, err.message);
        process.exitCode = 1;
        break;
      }
      if (err instanceof BrowserPhaseStoppedError) {
        markBrowserPhaseStopped(state, flow.id, err.message);
        process.exitCode = 1;
        break;
      }
      console.error(`Flow ${flow.id} error:`, err);
      if (!continueOnFail) {
        saveState(state);
        throw err;
      }
      ran += 1;
    }

    syncBatchCheckpoints(state);
    mkdirSync(join(ROOT, "docs/certification"), { recursive: true });
    writeFileSync(RESULTS_MD, generateResultsMarkdown(state));
  }

  console.log(`\nWrote ${RESULTS_MD}`);
  const fails = Object.values(state.results).filter(
    (r) => r.status === "FAIL" || r.status === "TIMEOUT",
  );
  if (fails.length) {
    console.error(`${fails.length} FAIL/TIMEOUT — see ${RESULTS_MD}`);
    process.exitCode = 1;
  }
}

runDisposableCert()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => setServerGuard(null));
