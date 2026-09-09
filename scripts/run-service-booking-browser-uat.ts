/**
 * Service-booking parity browser UAT — production user journeys on transovo.ai.
 *
 * DISPOSABLE BROWSER: one headless Chromium per flow, killed between flows.
 * NO local build / next dev — hits previewBaseUrl from browser-cert.config.ts only.
 *
 * Usage:
 *   CERT_BROWSER_PASSWORD='…' npm run cert:service-booking-browser
 *   CERT_BROWSER_PASSWORD='…' npm run cert:service-booking-browser -- --only SB-BATCH-01
 *   CERT_BROWSER_PASSWORD='…' npm run cert:service-booking-browser -- --flow SB-04
 *   BROWSER_CERT_SKIP_PROVENANCE=1 npm run cert:service-booking-browser -- --continue-on-fail
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BROWSER_CERT_CONFIG } from "./browser-cert/browser-cert.config";
import {
  BrowserPhaseStoppedError,
  runDisposableFlow,
} from "./browser-cert/disposable-browser";
import {
  resolveServiceBookingUatFlows,
  SERVICE_BOOKING_UAT_FLOWS,
} from "./browser-cert/service-booking-parity-flows";
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
  bootstrapCertWorkspaceOnPreview,
  generateResultsMarkdown,
  loadState,
  recordResult,
  saveState,
  type BrowserCertState,
} from "./browser-cert/lib";

const ROOT = join(import.meta.dirname, "..");
const CERT_DIR = join(ROOT, "docs/certification");
const RESULTS_MD = join(CERT_DIR, "SERVICE_BOOKING_BROWSER_UAT_RESULTS.md");

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

  let provenance: ReturnType<typeof verifyDeployProvenance>;
  const skipProvenance =
    process.env.BROWSER_CERT_SKIP_PROVENANCE === "1" ||
    process.env.BROWSER_CERT_SKIP_PROVENANCE?.toLowerCase() === "true";
  try {
    provenance = verifyDeployProvenance(baseUrl);
  } catch (err) {
    if (!skipProvenance) {
      console.error(err instanceof Error ? err.message : err);
      console.error("Set BROWSER_CERT_SKIP_PROVENANCE=1 to test deployed production anyway.");
      process.exit(1);
    }
    console.warn("WARN: Skipping deploy SHA provenance check (BROWSER_CERT_SKIP_PROVENANCE=1)");
    provenance = {
      gitCommitSha: "local",
      deployCommitSha: "production",
      provenanceOk: false,
    };
  }

  console.log("Service-booking browser UAT (disposable Chromium per flow):");
  console.log(`  URL:    ${baseUrl}`);
  console.log(`  flows:  ${SERVICE_BOOKING_UAT_FLOWS.length}`);
  console.log(`  mode:   no build — production browser only`);

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
        provenance: {
          gitCommitSha: provenance.gitCommitSha,
          deployCommitSha: provenance.deployCommitSha,
          provenanceVerified: provenance.provenanceOk,
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
    provenanceVerified: provenance.provenanceOk,
  };

  if (state.browserPhaseBlocked) {
    console.error(`Browser phase blocked: ${state.browserPhaseBlockedReason}`);
    console.error("Use --fresh after fixing environment, or clear state file.");
    process.exit(1);
  }

  const auth = await authenticate(baseUrl);
  if (!auth.ok) {
    console.error(
      "Login failed — set CERT_BROWSER_PASSWORD or UI_AGENT_SMOKE_EMAIL + UI_AGENT_SMOKE_PASSWORD",
    );
    process.exit(1);
  }
  console.log(`Authenticated as ${auth.email}`);
  await bootstrapCertWorkspaceOnPreview(baseUrl, auth.storageState);

  let flows = resolveServiceBookingUatFlows({ only, flowId, limit: 0 });
  if (limit > 0) flows = flows.slice(0, limit);

  if (retest) {
    for (const f of flows) {
      delete state.results[f.id];
      state.flowsCompleted = (state.flowsCompleted || []).filter((id) => id !== f.id);
    }
  }

  let ran = 0;
  for (const flow of flows) {
    if (limit > 0 && ran >= limit) break;
    const passed = state.results[flow.id]?.status === "PASS";
    if (passed && !retest && !fresh && (state.flowsCompleted || []).includes(flow.id)) {
      continue;
    }

    console.log(`\n--- ${flow.id} (${flow.batchId}) ---`);
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
      ran += 1;
    }
    saveState(state);
    mkdirSync(CERT_DIR, { recursive: true });
    writeFileSync(RESULTS_MD, generateResultsMarkdown(state));
  }

  writeFileSync(RESULTS_MD, generateResultsMarkdown(state));
  console.log(`\nResults: ${RESULTS_MD}`);

  const fails = Object.values(state.results).filter(
    (r) => r.status === "FAIL" || r.status === "TIMEOUT",
  );
  if (fails.length) {
    console.error(`${fails.length} FAIL/TIMEOUT`);
    process.exitCode = 1;
  }
}

runUat()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => setServerGuard(null));
