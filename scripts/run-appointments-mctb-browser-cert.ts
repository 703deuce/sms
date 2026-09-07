/**
 * Appointments + MCTB front-end browser certification runner.
 *
 * HARD RULE: runs only against a deployed preview/staging URL (BROWSER_CERT_BASE_URL).
 * Does NOT start local next dev, Turbopack, or any app server on the Cloud Agent VM.
 *
 * Usage:
 *   BROWSER_CERT_BASE_URL=https://preview.example.com \
 *   BROWSER_CERT_DEPLOY_SHA=$(git rev-parse HEAD) \
 *   npm run cert:appointments-mctb-browser -- --only BATCH-01 --retest
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { BATCHES } from "./browser-cert/batches";
import { writeProvenance } from "./browser-cert/provenance";
import {
  resolveCertBaseUrl,
  ServerGuard,
  setServerGuard,
  TestEnvironmentUnavailableError,
  verifyDeployProvenance,
  waitForDeployedApp,
} from "./browser-cert/server-guard";
import {
  attachConsoleCapture,
  authenticate,
  browserCertPreflight,
  generateResultsMarkdown,
  launchBrowser,
  loadState,
  reconcileStateProvenance,
  recordResult,
  RESULTS_MD,
  saveState,
  successScreenshot,
  type BrowserCertState,
} from "./browser-cert/lib";

const ROOT = join(import.meta.dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf("--from");
  const from = fromIdx >= 0 ? Number(args[fromIdx + 1]) : 1;
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? String(args[onlyIdx + 1]) : null;
  const fresh = args.includes("--fresh");
  const retest = args.includes("--retest");
  const continueOnFail = args.includes("--continue-on-fail");
  const preflight = args.includes("--preflight");
  return { from, only, fresh, retest, continueOnFail, preflight };
}

function markEnvironmentBlocked(state: BrowserCertState, batchId: string, reason: string) {
  state.environmentBlocked = true;
  state.environmentBlockedReason = reason;
  recordResult(state, batchId, "ENV-UNAVAILABLE", "BLOCKED — TEST ENVIRONMENT UNAVAILABLE", reason);
  saveState(state);
}

async function runBatches() {
  const { from, only, fresh, retest, continueOnFail, preflight } = parseArgs();

  if (preflight) {
    const r = await browserCertPreflight();
    console.log(r.message);
    process.exit(r.ok ? 0 : 1);
  }

  let baseUrl: string;
  let provenance: ReturnType<typeof verifyDeployProvenance>;
  try {
    baseUrl = resolveCertBaseUrl();
    provenance = verifyDeployProvenance();
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

  console.log("Browser certification provenance:");
  console.log(`  base URL:      ${baseUrl}`);
  console.log(`  git SHA:       ${provenance.gitCommitSha}`);
  console.log(`  deploy SHA:    ${provenance.deployCommitSha}`);
  console.log(`  started:       ${startedAt}`);

  if (!waitForDeployedApp(baseUrl)) {
    console.error(`Deployed application not reachable at ${baseUrl} (/api/health or /)`);
    process.exit(1);
  }

  const guard = new ServerGuard({ baseUrl, consecutiveFailureLimit: 2 });
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
      }
    : loadState();
  state.baseUrl = baseUrl;
  state.provenance = {
    gitCommitSha: provenance.gitCommitSha,
    deployCommitSha: provenance.deployCommitSha,
    provenanceVerified: true,
  };

  const reconcile = reconcileStateProvenance(state, baseUrl, provenance.deployCommitSha);
  if (reconcile.cleared > 0) {
    console.log(
      `\nProvenance reconcile: cleared ${reconcile.cleared} stale results (${reconcile.reason}).`,
    );
    console.log(
      "Prior PASS from localhost or a different deploy are not valid for final certification — rerunning on preview.",
    );
    saveState(state);
  }

  const auth = await authenticate(baseUrl);
  if (!auth.ok) {
    console.error("Authentication failed — configure CERT_BROWSER_EMAIL/PASSWORD on the preview deployment");
    process.exit(1);
  }
  console.log(`Authenticated as ${auth.email}`);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      storageState: auth.storageState,
    });
    page = await context.newPage();
    attachConsoleCapture(page);

    const startIdx = only
      ? Math.max(0, BATCHES.findIndex((b) => b.id === only))
      : Math.max(0, from - 1);
    if (only && startIdx < 0) {
      console.error(`Unknown batch: ${only}. Use BATCH-01 … BATCH-${String(BATCHES.length).padStart(2, "0")}`);
      process.exit(1);
    }
    const endIdx = only ? startIdx + 1 : BATCHES.length;

    for (let i = startIdx; i < endIdx; i++) {
      const batch = BATCHES[i];
      if (state.batchesCompleted.includes(batch.id) && !fresh && !retest) {
        console.log(`\n=== Skip ${batch.id} (already checkpointed — use --retest to rerun) ===`);
        continue;
      }

      if (retest && batch.id) {
        for (const [key, result] of Object.entries(state.results)) {
          if (result.batchId === batch.id) delete state.results[key];
        }
        state.batchesCompleted = state.batchesCompleted.filter((id) => id !== batch.id);
      }

      console.log(`\n=== ${batch.id}: ${batch.title} ===`);
      try {
        guard.assertHealthy(batch.id);
      } catch (err) {
        if (err instanceof TestEnvironmentUnavailableError) {
          markEnvironmentBlocked(state, batch.id, err.message);
          process.exitCode = 1;
          break;
        }
        throw err;
      }

      try {
        await batch.run({ state, page, batchId: batch.id });
        await successScreenshot(page, batch.id);
      } catch (err) {
        if (err instanceof TestEnvironmentUnavailableError) {
          markEnvironmentBlocked(state, batch.id, err.message);
          process.exitCode = 1;
          break;
        }
        console.error(`Batch ${batch.id} error:`, err);
        if (!continueOnFail) {
          saveState(state);
          throw err;
        }
      }

      if (!state.batchesCompleted.includes(batch.id)) {
        state.batchesCompleted.push(batch.id);
      }
      saveState(state);

      if (only) {
        console.log(`\nCompleted single batch: ${batch.id}`);
        break;
      }

      await page.goto("/appointments/overview", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(
        () => page!.goto("/mctb", { waitUntil: "domcontentloaded" }).catch(() => {}),
      );
      await page.waitForTimeout(300);
    }

    mkdirSync(join(ROOT, "docs/certification"), { recursive: true });
    writeFileSync(RESULTS_MD, generateResultsMarkdown(state));
    console.log(`\nWrote ${RESULTS_MD}`);

    const fails = Object.values(state.results).filter(
      (r) => r.status === "FAIL" || r.status === "TIMEOUT",
    );
    if (fails.length) {
      console.error(`\n${fails.length} FAIL/TIMEOUT — see ${RESULTS_MD}`);
      process.exitCode = 1;
    }
  } finally {
    setServerGuard(null);
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

runBatches().catch((err) => {
  console.error(err);
  process.exit(1);
});
