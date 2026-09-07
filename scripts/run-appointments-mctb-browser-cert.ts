/**
 * Appointments + MCTB front-end browser certification runner.
 *
 * Resource-constrained: one browser, one page/tab, serial batches, no parallel workers.
 * Does NOT rerun backend/unit certification.
 *
 * Usage:
 *   npm run cert:appointments-mctb-browser
 *   npm run cert:appointments-mctb-browser -- --from 3 --continue-on-fail
 *   npm run cert:appointments-mctb-browser -- --fresh
 *   BROWSER_CERT_BASE_URL=http://localhost:3000 npm run cert:appointments-mctb-browser
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { BATCHES } from "./browser-cert/batches";
import {
  ARTIFACTS_DIR,
  authenticate,
  attachConsoleCapture,
  generateResultsMarkdown,
  launchBrowser,
  loadState,
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
  const fresh = args.includes("--fresh");
  const continueOnFail = args.includes("--continue-on-fail");
  const noServer = args.includes("--no-server");
  const stopServer = args.includes("--stop-server");
  return { from, fresh, continueOnFail, noServer, stopServer };
}

function isPortFree(port: number): boolean {
  const r = spawnSync("bash", ["-c", `ss -tln | grep -q ':${port} ' && echo busy || echo free`], {
    encoding: "utf8",
  });
  return r.stdout?.trim() === "free";
}

function waitForServer(baseUrl: string, maxMs = 180_000): boolean {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", `${baseUrl}/`], {
        encoding: "utf8",
      });
      const code = r.stdout?.trim();
      if (code && code !== "000" && Number(code) < 500) return true;
    } catch {
      /* retry */
    }
    spawnSync("sleep", ["3"]);
  }
  return false;
}

function startDevServer(): boolean {
  if (!isPortFree(3000)) {
    console.log("Port 3000 already in use — reusing existing server");
    return true;
  }
  const cmd = `cd ${ROOT} && DEV_AUTH_BYPASS=1 npm run dev -- -p 3000`;
  spawnSync("tmux", [
    "-f",
    "/exec-daemon/tmux.portal.conf",
    "new-session",
    "-d",
    "-s",
    "browser-cert-dev",
    cmd,
  ]);
  return waitForServer("http://127.0.0.1:3000");
}

function stopDevServer() {
  spawnSync("tmux", ["-f", "/exec-daemon/tmux.portal.conf", "kill-session", "-t", "browser-cert-dev"], {
    stdio: "ignore",
  });
}

async function runBatches() {
  const { from, fresh, continueOnFail, noServer, stopServer } = parseArgs();
  const baseUrl = (process.env.BROWSER_CERT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

  let startedServer = false;
  if (!noServer && !process.env.BROWSER_CERT_BASE_URL) {
    startedServer = startDevServer();
    if (!startedServer) {
      console.error("Failed to start dev server on port 3000");
      process.exit(1);
    }
  } else if (!waitForServer(baseUrl, 30_000)) {
    console.error(`Server not reachable at ${baseUrl}`);
    process.exit(1);
  }

  let state: BrowserCertState = fresh
    ? {
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        baseUrl,
        results: {},
        batchesCompleted: [],
      }
    : loadState();
  state.baseUrl = baseUrl;

  const auth = await authenticate(baseUrl);
  if (!auth.ok) {
    console.error("Authentication failed — set DEV_AUTH_BYPASS=1 or ensure smoke-signup works");
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

    const startIdx = Math.max(0, from - 1);
    for (let i = startIdx; i < BATCHES.length; i++) {
      const batch = BATCHES[i];
      if (state.batchesCompleted.includes(batch.id) && !fresh) {
        console.log(`\n=== Skip ${batch.id} (already checkpointed) ===`);
        continue;
      }

      console.log(`\n=== ${batch.id}: ${batch.title} ===`);
      try {
        await batch.run({ state, page, batchId: batch.id });
        await successScreenshot(page, batch.id);
      } catch (err) {
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

      // Memory hygiene between batches
      await page.goto("/appointments/overview", { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(
        () => page!.goto("/mctb", { waitUntil: "domcontentloaded" }).catch(() => {}),
      );
      await page.waitForTimeout(300);
    }

    const md = generateResultsMarkdown(state);
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(join(ROOT, "docs/certification"), { recursive: true });
    writeFileSync(RESULTS_MD, md);
    console.log(`\nWrote ${RESULTS_MD}`);

    const fails = Object.values(state.results).filter((r) => r.status === "FAIL" || r.status === "TIMEOUT");
    if (fails.length) {
      console.error(`\n${fails.length} FAIL/TIMEOUT — see ${RESULTS_MD}`);
      process.exitCode = 1;
    }
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (startedServer && stopServer) stopDevServer();
  }
}

runBatches().catch((err) => {
  console.error(err);
  process.exit(1);
});
