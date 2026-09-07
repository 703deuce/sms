/**
 * Disposable-browser certification: one headless Chromium per flow, then fully exit.
 * No persistent browser across flows or batches.
 */
import type { Browser, BrowserContext, Page } from "playwright";
import {
  attachConsoleCapture,
  failureScreenshot,
  FLOW_TIMEOUT,
  launchBrowser,
  recordResult,
  saveState,
  withFlowTimeout,
  type BrowserCertState,
  type CertStatus,
} from "./lib";
import {
  getServerGuard,
  isServerConnectionError,
  TestEnvironmentUnavailableError,
} from "./server-guard";
import type { BrowserFlow } from "./flows";
import { BROWSER_CERT_CONFIG } from "./browser-cert.config";

export const DISPOSABLE_PAUSE_MS = BROWSER_CERT_CONFIG.disposablePauseMs;

export class BrowserPhaseStoppedError extends Error {
  readonly status = "BLOCKED — BROWSER PHASE STOPPED" as const;

  constructor(message: string) {
    super(message);
    this.name = "BrowserPhaseStoppedError";
  }
}

function isBrowserProcessCrash(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Target closed|Browser closed|browser has been closed|Protocol error.*Target|crashed|SIGKILL|SIGSEGV|ENOMEM/i.test(
      msg,
    ) || /launch.*failed|Failed to launch/i.test(msg)
  );
}

async function killBrowser(browser: Browser | null) {
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    /* already dead */
  }
  if (browser.isConnected()) {
    throw new Error("Browser process did not exit after close()");
  }
}

export type DisposableRunOptions = {
  baseUrl: string;
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  flow: BrowserFlow;
  state: BrowserCertState;
};

export async function runDisposableFlow(opts: DisposableRunOptions): Promise<void> {
  const { baseUrl, storageState, flow, state } = opts;

  if (state.browserPhaseBlocked) {
    throw new BrowserPhaseStoppedError(
      state.browserPhaseBlockedReason ||
        `Browser phase stopped at ${state.lastUnfinishedFlowId ?? "unknown"}`,
    );
  }

  const existing = state.results[flow.id];
  if (existing?.status === "PASS" && !flow.force) {
    console.log(`↷ ${flow.id}: already PASS — skip`);
    return;
  }

  if (flow.static) {
    recordResult(state, flow.batchId, flow.id, flow.static.status, flow.static.detail);
    state.flowsCompleted = state.flowsCompleted || [];
    if (!state.flowsCompleted.includes(flow.id)) state.flowsCompleted.push(flow.id);
    saveState(state);
    return;
  }

  if (!flow.run) {
    recordResult(state, flow.batchId, flow.id, "FAIL", "Flow has no run() implementation");
    saveState(state);
    return;
  }

  getServerGuard()?.assertHealthy(flow.id);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 1440, height: 900 },
      storageState,
      recordVideo: undefined,
    });
    page = await context.newPage();
    attachConsoleCapture(page);

    await withFlowTimeout(flow.id, FLOW_TIMEOUT, () => flow.run!(page));
    getServerGuard()?.recordNavigationSuccess();
    recordResult(state, flow.batchId, flow.id, "PASS");
    state.consecutiveBrowserCrashes = 0;
  } catch (err) {
    if (err instanceof TestEnvironmentUnavailableError) throw err;
    if (err instanceof BrowserPhaseStoppedError) throw err;

    const msg = err instanceof Error ? err.message : String(err);

    if (isBrowserProcessCrash(err)) {
      state.consecutiveBrowserCrashes = (state.consecutiveBrowserCrashes || 0) + 1;
      state.lastUnfinishedFlowId = flow.id;
      const detail = `Browser process crash on ${flow.id}: ${msg.slice(0, 300)}`;
      recordResult(state, flow.batchId, flow.id, "FAIL", detail);
      saveState(state);

      if (state.consecutiveBrowserCrashes >= BROWSER_CERT_CONFIG.consecutiveBrowserCrashLimit) {
        state.browserPhaseBlocked = true;
        state.browserPhaseBlockedReason = `${BROWSER_CERT_CONFIG.consecutiveBrowserCrashLimit} consecutive browser crashes — last flow ${flow.id}`;
        saveState(state);
        throw new BrowserPhaseStoppedError(state.browserPhaseBlockedReason);
      }
      return;
    }

    const status: CertStatus = msg.startsWith("TIMEOUT:") ? "TIMEOUT" : "FAIL";
    if (page) await failureScreenshot(page, `${flow.id}-${status}`);
    recordResult(state, flow.batchId, flow.id, status, msg.slice(0, 500));
    if (isServerConnectionError(msg)) {
      getServerGuard()?.recordConnectionFailure(msg);
    }
    state.consecutiveBrowserCrashes = 0;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    await killBrowser(browser);
    await new Promise((r) => setTimeout(r, DISPOSABLE_PAUSE_MS));
  }

  state.flowsCompleted = state.flowsCompleted || [];
  if (!state.flowsCompleted.includes(flow.id)) state.flowsCompleted.push(flow.id);
  state.lastUnfinishedFlowId = undefined;
  saveState(state);
}
