/**
 * Shared helpers for Appointments + MCTB front-end browser certification.
 * Resource-constrained: one browser, one page, serial flows, minimal screenshots.
 */
import type { Browser, BrowserContext, Page, Request as PWRequest } from "playwright";
import { chromium, request } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import {
  getServerGuard,
  isServerConnectionError,
  TestEnvironmentUnavailableError,
} from "./server-guard";
import { BROWSER_CERT_CONFIG } from "./browser-cert.config";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) dotenv.config({ path: p });
}

export type CertStatus =
  | "PASS"
  | "FAIL"
  | "TIMEOUT"
  | "BLOCKED — LIVE PSTN"
  | "BLOCKED — LIVE MEDIA"
  | "BLOCKED — LIVE EXTERNAL PROVIDER"
  | "BLOCKED — TEST ENVIRONMENT UNAVAILABLE"
  | "BLOCKED — BROWSER PHASE STOPPED"
  | "INVALID RESULT — LOCAL CERT SERVER OOM"
  | "NOT IMPLEMENTED"
  | "INTENTIONALLY DEFERRED"
  | "SKIPPED";

export type CertResult = {
  id: string;
  status: CertStatus;
  detail: string;
  batchId: string;
  at: string;
};

export type BrowserCertState = {
  startedAt: string;
  updatedAt: string;
  baseUrl: string;
  provenance?: {
    gitCommitSha: string;
    deployCommitSha: string;
    provenanceVerified: boolean;
  };
  results: Record<string, CertResult>;
  batchesCompleted: string[];
  /** Per-flow checkpoint IDs (disposable-browser mode) */
  flowsCompleted?: string[];
  environmentBlocked?: boolean;
  environmentBlockedReason?: string;
  browserPhaseBlocked?: boolean;
  browserPhaseBlockedReason?: string;
  consecutiveBrowserCrashes?: number;
  lastUnfinishedFlowId?: string;
};

export const CERT_DIR = join(process.cwd(), "docs/certification");
export const STATE_FILE = join(CERT_DIR, "appointments-mctb-browser-cert-state.json");
export const RESULTS_MD = join(CERT_DIR, "APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md");
export const ARTIFACTS_DIR =
  process.env.BROWSER_CERT_ARTIFACTS_DIR || join(process.cwd(), "artifacts/browser-cert");

export const NAV_TIMEOUT = BROWSER_CERT_CONFIG.navTimeoutMs;
export const ACTION_TIMEOUT = BROWSER_CERT_CONFIG.actionTimeoutMs;
export const FLOW_TIMEOUT = BROWSER_CERT_CONFIG.flowTimeoutMs;
export const CERT_GROUP_TIMEOUT = BROWSER_CERT_CONFIG.groupTimeoutMs;
export const ROUTE_PAUSE_MS = 1500;

export const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
];

export function loadState(): BrowserCertState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as BrowserCertState;
  }
  return {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseUrl: "",
    results: {},
    batchesCompleted: [],
  };
}

function sanitizeCertDetail(detail: string): string {
  return detail
    .replace(/https?:\/\/[^\s/]+/gi, "[REDACTED]")
    .replace(/→ GET \S+/g, "→ GET [REDACTED]/api/…")
    .replace(/got \[REDACTED\]\//g, "got [REDACTED]/")
    .slice(0, 400);
}

export function saveState(state: BrowserCertState) {
  mkdirSync(CERT_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  if (state.baseUrl) state.baseUrl = "[REDACTED]";
  for (const result of Object.values(state.results)) {
    if (result.detail) result.detail = sanitizeCertDetail(result.detail);
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/** Results preserved across deploy/environment changes (not re-run automatically). */
const PRESERVE_ACROSS_ENV_CHANGE: CertStatus[] = [
  "BLOCKED — LIVE PSTN",
  "BLOCKED — LIVE MEDIA",
  "BLOCKED — LIVE EXTERNAL PROVIDER",
  "BLOCKED — TEST ENVIRONMENT UNAVAILABLE",
  "NOT IMPLEMENTED",
  "INTENTIONALLY DEFERRED",
  "SKIPPED",
];

function isLocalCertUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export type ProvenanceReconcileResult = {
  cleared: number;
  reason: string | null;
  priorBaseUrl: string;
  priorDeploySha: string | null;
};

/**
 * Drop PASS/FAIL/INVALID/etc. when base URL or deploy SHA changes.
 * Localhost pre-OOM PASS results are never carried forward to preview certification.
 */
export function reconcileStateProvenance(
  state: BrowserCertState,
  baseUrl: string,
  deployCommitSha: string,
): ProvenanceReconcileResult {
  const priorBaseUrl = state.baseUrl || "";
  const priorDeploySha = state.provenance?.deployCommitSha ?? null;
  const sameUrl = priorBaseUrl.replace(/\/$/, "") === baseUrl.replace(/\/$/, "");
  const sameSha =
    priorDeploySha !== null &&
    priorDeploySha.toLowerCase() === deployCommitSha.toLowerCase();

  const fromLocalhost = isLocalCertUrl(priorBaseUrl);
  const envChanged = !sameUrl || !sameSha || fromLocalhost;

  if (!envChanged || Object.keys(state.results).length === 0) {
    return { cleared: 0, reason: null, priorBaseUrl, priorDeploySha };
  }

  let cleared = 0;
  for (const [id, result] of Object.entries(state.results)) {
    if (PRESERVE_ACROSS_ENV_CHANGE.includes(result.status)) continue;
    delete state.results[id];
    cleared += 1;
  }
  state.batchesCompleted = [];
  state.environmentBlocked = false;
  state.environmentBlockedReason = undefined;

  const reason = fromLocalhost
    ? "prior run used localhost — preview certification requires a full rerun at the same deploy SHA"
    : !sameSha
      ? `deploy SHA changed (${priorDeploySha?.slice(0, 7) ?? "?"} → ${deployCommitSha.slice(0, 7)})`
      : `base URL changed (${priorBaseUrl} → ${baseUrl})`;

  return { cleared, reason, priorBaseUrl, priorDeploySha };
}

export function recordResult(
  state: BrowserCertState,
  batchId: string,
  id: string,
  status: CertStatus,
  detail = "",
) {
  const safeDetail = sanitizeCertDetail(detail);
  state.results[id] = { id, status, detail: safeDetail, batchId, at: new Date().toISOString() };
  const icon =
    status === "PASS"
      ? "✓"
      : status.startsWith("BLOCKED")
        ? "⊘"
        : status === "INVALID RESULT — LOCAL CERT SERVER OOM"
          ? "○"
          : status === "NOT IMPLEMENTED" || status === "INTENTIONALLY DEFERRED"
            ? "—"
            : "✗";
  console.log(`${icon} ${id}: ${status}${safeDetail ? ` — ${safeDetail}` : ""}`);
}

export function withFlowTimeout<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`TIMEOUT: ${label} after ${ms}ms`)), ms);
    fn()
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
}

export async function authenticate(baseUrl: string): Promise<{
  ok: boolean;
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  email: string;
}> {
  const api = await request.newContext({
    baseURL: baseUrl,
    timeout: Number(process.env.BROWSER_CERT_API_TIMEOUT_MS || 120_000),
  });
  const useDevBypass =
    process.env.DEV_AUTH_BYPASS?.trim() === "1" ||
    process.env.DEV_AUTH_BYPASS?.trim()?.toLowerCase() === "true";

  if (useDevBypass) {
    const email = process.env.DEV_AUTH_BYPASS_EMAIL || BROWSER_CERT_CONFIG.certEmail;
    const bypass = await api.get(
      `/api/auth/dev-bypass?next=/appointments/overview&email=${encodeURIComponent(email)}`,
      { maxRedirects: 0 },
    );
    const ok = bypass.ok() || [302, 307, 308].includes(bypass.status());
    if (ok) {
      const storageState = await api.storageState();
      await api.dispose();
      return { ok: true, storageState, email };
    }
  }

  const stableEmail = BROWSER_CERT_CONFIG.certEmail;
  const stablePassword = process.env.CERT_BROWSER_PASSWORD?.trim();
  if (!stablePassword) {
    await api.dispose();
    return {
      ok: false,
      storageState: await api.storageState(),
      email: stableEmail,
    };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const login = await api.post("/api/auth/login", {
      data: { email: stableEmail, password: stablePassword, next: "/appointments/overview" },
    });
    const loginBody = await login.json().catch(() => ({}));
    if (login.ok() && !loginBody.error) {
      const storageState = await api.storageState();
      await api.dispose();
      return { ok: true, storageState, email: stableEmail };
    }
    if (attempt < 1) await new Promise((r) => setTimeout(r, 3000));
  }

  const emptyState = { cookies: [] as [], origins: [] as [] };
  await api.dispose();
  return { ok: false, storageState: emptyState, email: stableEmail };
}

/** Idempotent preview bootstrap for cert workspace (appointment types, MCTB fixtures). */
export async function bootstrapCertWorkspaceOnPreview(
  baseUrl: string,
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>,
): Promise<boolean> {
  const api = await request.newContext({
    baseURL: baseUrl,
    storageState,
    timeout: Number(process.env.BROWSER_CERT_API_TIMEOUT_MS || 120_000),
  });
  const res = await api.post("/api/cert/appointments-mctb/bootstrap");
  await api.dispose();
  if (res.ok()) return true;
  if (res.status() === 404) {
    console.warn("Cert bootstrap API not deployed yet — using per-flow API ensure helpers");
    return false;
  }
  const body = await res.json().catch(() => ({}));
  console.warn(`Cert bootstrap returned ${res.status()}: ${body.error || "unknown"}`);
  return false;
}

export async function visitRoute(
  page: Page,
  path: string,
  opts: { allow404?: boolean; navTimeout?: number } = {},
): Promise<{ ok: boolean; status: number; note: string }> {
  const timeout = opts.navTimeout ?? NAV_TIMEOUT;
  getServerGuard()?.assertHealthy(path);
  try {
    const resp = await page.goto(path, { waitUntil: "domcontentloaded", timeout });
    await page.waitForTimeout(300);
    const body = await page.locator("body").innerText().catch(() => "");
    const status = resp?.status() || 0;
    if (!opts.allow404 && (status === 404 || /could not be found/i.test(body))) {
      return { ok: false, status, note: "404" };
    }
    if (status >= 500 || ERROR_PATTERNS.some((re) => re.test(body))) {
      return { ok: false, status, note: `HTTP ${status} or error page` };
    }
    if (page.url().includes("/login")) {
      return { ok: false, status, note: "redirected to login" };
    }
    return { ok: true, status, note: "" };
  } catch (err) {
    if (err instanceof TestEnvironmentUnavailableError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, note: msg };
  }
}

export async function failureScreenshot(page: Page, name: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const path = join(ARTIFACTS_DIR, `${safe}.png`);
  await page.screenshot({ path, fullPage: false }).catch(() => {});
  return path;
}

export async function successScreenshot(page: Page, name: string) {
  if (process.env.BROWSER_CERT_SCREENSHOTS !== "1") return null;
  return failureScreenshot(page, `success-${name}`);
}

export async function switchProductShell(page: Page, label: "Appointments" | "Missed Call Text Back") {
  const dismiss = page.getByRole("button", { name: /got it/i }).first();
  if (await dismiss.count()) {
    await dismiss.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(300);
  }

  const btn = page.getByRole("button", { name: /Switch product/i }).first();
  if (!(await btn.count())) return { ok: false, note: "product switcher not found" };
  await btn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(400);

  const option = page.getByRole("option", { name: label }).first();
  await option.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await option.scrollIntoViewIfNeeded().catch(() => {});
  await option.click({ timeout: ACTION_TIMEOUT, force: true }).catch(async () => {
    await option.focus();
    await page.keyboard.press("Enter");
  });
  await page.waitForTimeout(500);
  return { ok: true, note: "" };
}

export async function clickLinkIfPresent(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  if (await link.count()) {
    await link.click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

export function attachConsoleCapture(page: Page): string[] {
  const logs: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") logs.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => logs.push(`pageerror: ${err.message}`));
  return logs;
}

export async function runCertCase(
  state: BrowserCertState,
  batchId: string,
  id: string,
  page: Page,
  fn: () => Promise<void>,
  blocked?: { status: CertStatus; reason: string },
) {
  if (blocked) {
    recordResult(state, batchId, id, blocked.status, blocked.reason);
    return;
  }
  if (state.results[id]?.status === "PASS") {
    console.log(`↷ ${id}: already PASS — skip`);
    return;
  }
  try {
    await withFlowTimeout(id, FLOW_TIMEOUT, fn);
    getServerGuard()?.recordNavigationSuccess();
    recordResult(state, batchId, id, "PASS");
  } catch (err) {
    if (err instanceof TestEnvironmentUnavailableError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    const status: CertStatus = msg.startsWith("TIMEOUT:") ? "TIMEOUT" : "FAIL";
    await failureScreenshot(page, `${id}-${status}`);
    recordResult(state, batchId, id, status, msg.slice(0, 500));
    if (isServerConnectionError(msg)) {
      getServerGuard()?.recordConnectionFailure(msg);
    }
  }
}

/** Preflight only — verify env, provenance, and deployed health without launching Chromium. */
export async function browserCertPreflight(): Promise<{ ok: boolean; message: string }> {
  const { resolveCertBaseUrl, verifyDeployProvenance, fetchPreviewHealth } = await import(
    "./server-guard"
  );
  try {
    const baseUrl = resolveCertBaseUrl();
    const health = fetchPreviewHealth(baseUrl);
    const provenance = verifyDeployProvenance(baseUrl);
    if (!health.ok) {
      return { ok: false, message: `Preview not reachable at ${baseUrl}/api/health` };
    }
    return {
      ok: true,
      message:
        `OK — ${baseUrl} · local ${provenance.gitCommitSha.slice(0, 7)} · ` +
        `deployed ${provenance.deployCommitSha.slice(0, 7)} (matched via /api/health)`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function visitRoutesBatch(
  state: BrowserCertState,
  batchId: string,
  page: Page,
  routes: Array<{ id: string; path: string; allow404?: boolean; navTimeout?: number }>,
) {
  for (const r of routes) {
    try {
      getServerGuard()?.assertHealthy(r.path);
      await runCertCase(state, batchId, r.id, page, async () => {
        const v = await visitRoute(page, r.path, { allow404: r.allow404, navTimeout: r.navTimeout });
        if (!v.ok) throw new Error(`${r.path}: ${v.note}`);
      });
    } catch (err) {
      if (err instanceof TestEnvironmentUnavailableError) {
        console.error(`\n⛔ ${err.message}`);
        throw err;
      }
      throw err;
    }
    await page.waitForTimeout(ROUTE_PAUSE_MS);
  }
}

export function generateResultsMarkdown(state: BrowserCertState): string {
  const counts: Record<string, number> = {};
  const uaPass = Object.values(state.results).filter(
    (r) => r.status === "PASS" && /^APT-\d+$|^MCTB-\d+$|^CROSS-\d+$|^GLOBAL-\d+$/.test(r.id),
  ).length;
  const reachPass = Object.values(state.results).filter(
    (r) => r.status === "PASS" && !/^APT-\d+$|^MCTB-\d+$|^CROSS-\d+$|^GLOBAL-\d+$/.test(r.id),
  ).length;
  for (const r of Object.values(state.results)) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  const lines = [
    "# Appointments + MCTB Browser Certification Results",
    "",
    `**Updated:** ${state.updatedAt}`,
    `**Base URL:** \`scripts/browser-cert/browser-cert.config.ts\` → previewBaseUrl`,
    `**Provenance:** git \`${state.provenance?.gitCommitSha ?? "?"}\` · deploy \`${state.provenance?.deployCommitSha ?? "?"}\``,
    "",
    `**State file:** \`docs/certification/appointments-mctb-browser-cert-state.json\``,
    `**Mode:** disposable-browser (${state.flowsCompleted?.length ?? 0}/${Object.keys(state.results).length} flows checkpointed)`,
    "",
    "## Summary",
    "",
    "| Status | Count |",
    "|--------|-------|",
    ...Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, n]) => `| ${s} | ${n} |`),
    "",
    "### Certification tiers",
    "",
    "| Tier | PASS count | Notes |",
    "|------|------------|-------|",
    `| Reachability (BATCH-01–14) | ${reachPass} | Route/render — not sufficient alone for operable features |`,
    `| Go-live cert groups (APT/MCTB/CROSS/GLOBAL) | ${uaPass} | True click/type/save/reload journeys |`,
    "",
    "See `docs/certification/BROWSER_CERT_USER_ACTION_STANDARD.md` and `BROWSER_FLOW_CLASSIFICATION_AUDIT.md`.",
    "",
    "## Results by ID",
    "",
    "| ID | Status | Detail | Batch |",
    "|----|--------|--------|-------|",
    ...Object.values(state.results)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => `| ${r.id} | ${r.status} | ${r.detail.replace(/\|/g, "\\|").slice(0, 120)} | ${r.batchId} |`),
    "",
  ];
  return lines.join("\n");
}
