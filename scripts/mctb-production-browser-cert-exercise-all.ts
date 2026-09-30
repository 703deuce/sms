/**
 * Phase 3: Live browser exercise — every visible safe control clicked/filled (production).
 * Manifest-only rows do NOT count as certified.
 *
 * MCTB_PROD_CERT_BASE_URL=... MCTB_PROD_CERT_EMAIL=... \
 *   npx tsx scripts/mctb-production-browser-cert-exercise-all.ts
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { authenticateMctbProd, healthSha } from "./mctb-browser-cert/auth";
import { loadSkipKeys, recordRow, type CertRow } from "./mctb-browser-cert/matrix";
import { clickAllTabs } from "./mctb-browser-cert/discover";
import { attachHttpWatch, exerciseLiveControls } from "./mctb-browser-cert/live-exercise";
import { testNotificationsCrud } from "./mctb-browser-cert/section-notifications";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const EMAIL =
  process.env.MCTB_PROD_CERT_EMAIL?.trim() ||
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  "";
const ARTIFACT_DIR = process.env.MCTB_PROD_CERT_ARTIFACTS || "/tmp/mctb-prod-browser-cert-exercise";
const MATRIX_PATH =
  process.env.MCTB_PROD_CERT_EXERCISE_MATRIX ||
  join(process.cwd(), "docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION-EXERCISE.md");

const ROUTES: { path: string; label: string }[] = [
  { path: "/mctb", label: "Overview" },
  { path: "/mctb/missed-call-recovery", label: "Recovery hub" },
  { path: "/mctb/missed-call-recovery?tab=consent", label: "Recovery hub" },
  { path: "/mctb/missed-call-recovery?tab=exclusions", label: "Recovery hub" },
  { path: "/mctb/missed-call-recovery?tab=rules", label: "Recovery hub" },
  { path: "/onboarding/mctb", label: "Onboarding" },
  { path: "/mctb/missed-calls", label: "Missed Calls" },
  { path: "/mctb/conversations", label: "Conversations" },
  { path: "/mctb/voicemail", label: "Voicemail inbox" },
  { path: "/mctb/analytics", label: "Analytics" },
  { path: "/mctb/notifications", label: "Notifications" },
  { path: "/mctb/setup", label: "Setup overview" },
  { path: "/mctb/setup/start", label: "Setup wizard" },
  { path: "/mctb/setup/phone", label: "Setup Phone" },
  { path: "/mctb/setup/missed-call-rules", label: "Setup Missed-call rules" },
  { path: "/mctb/setup/text-back", label: "Setup Text back" },
  { path: "/mctb/setup/consent", label: "Setup Consent" },
  { path: "/mctb/setup/notifications", label: "Setup Notifications" },
  { path: "/mctb/setup/recovery", label: "Setup Recovery" },
  { path: "/mctb/setup/voicemail", label: "Setup Voicemail" },
  { path: "/mctb/setup/links", label: "Setup Links" },
  { path: "/mctb/setup/exclusions", label: "Setup Exclusions" },
  { path: "/mctb/setup/test", label: "Setup Test" },
  { path: "/mctb/compliance/consent", label: "Consent log" },
  { path: "/mctb/ai-recovery", label: "AI Recovery" },
  { path: "/mctb/phone", label: "Own Sender / Phone" },
  { path: "/mctb/numbers", label: "Phone inventory" },
  { path: "/mctb/text-back", label: "Text back (launch)" },
];

const rows: CertRow[] = [];
let skipKeys: Set<string>;
const done = new Set<string>();

function initMatrix(sha: string) {
  const marker = "# MCTB Production Browser Certification — LIVE EXERCISE";
  if (existsSync(MATRIX_PATH) && readFileSync(MATRIX_PATH, "utf8").includes(marker)) return;
  writeFileSync(
    MATRIX_PATH,
    `${marker}

**Production SHA:** ${sha}  
**Started:** ${new Date().toISOString()}  
**Rule:** Each row = real browser click/fill/toggle (not manifest-only).

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
`,
  );
}

function record(row: CertRow) {
  if (!recordRow(MATRIX_PATH, row, skipKeys)) return;
  rows.push(row);
}

async function gotoRoute(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
  await page.waitForTimeout(1000);
}

async function exerciseRoute(page: Page, path: string, label: string, httpErrors: string[]): Promise<void> {
  await gotoRoute(page, path);
  const tabNames = await clickAllTabs(page);
  const surfaces = ["main", ...tabNames.filter((t, i, a) => a.indexOf(t) === i)];

  for (const tab of surfaces) {
    if (tab !== "main") {
      const t = page.getByRole("tab", { name: new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
      if (await t.isVisible().catch(() => false)) await t.click().catch(() => undefined);
      await page.waitForTimeout(600);
    }
    await exerciseLiveControls(page, {
      route: path,
      pageLabel: label,
      tab,
      record,
      done,
      httpErrors,
      skipGlobalSidebarLinks: true,
    });
    const more = page.getByRole("button", { name: /more|overflow|options|\.\.\./i });
    if (await more.first().isVisible().catch(() => false)) {
      await more.first().click().catch(() => undefined);
      await page.waitForTimeout(500);
      await exerciseLiveControls(page, {
        route: path,
        pageLabel: label,
        tab: `${tab} (menu open)`,
        record,
        done,
        httpErrors,
        skipGlobalSidebarLinks: true,
      });
      await page.keyboard.press("Escape").catch(() => undefined);
    }
  }
}

async function mobilePass(page: Page, httpErrors: string[]): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { path, label } of ROUTES.slice(0, 12)) {
    await gotoRoute(page, path);
    const menu = page.getByRole("button", { name: /menu|navigation|sidebar/i }).first();
    if (await menu.isVisible().catch(() => false)) await menu.click().catch(() => undefined);
    await exerciseLiveControls(page, {
      route: path,
      pageLabel: `${label} (mobile)`,
      tab: "390px",
      record,
      done,
      httpErrors,
      skipGlobalSidebarLinks: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function main() {
  if (!BASE || !EMAIL) throw new Error("Set MCTB_PROD_CERT_BASE_URL and email");
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const sha = await healthSha(BASE);
  skipKeys = loadSkipKeys(MATRIX_PATH);
  initMatrix(sha);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(60_000);
  await authenticateMctbProd(context, BASE, process.env.MCTB_PROD_CERT_WORKSPACE_ID || "ws_1", EMAIL);
  const page = await context.newPage();
  const httpErrors: string[] = [];
  attachHttpWatch(page, BASE, httpErrors);

  for (const r of ROUTES) {
    await exerciseRoute(page, r.path, r.label, httpErrors);
  }

  await testNotificationsCrud(page, BASE, record);
  await mobilePass(page, httpErrors);

  await browser.close();

  const exercised = rows.filter((r) => r.status.includes("LIVE EXERCISE") || r.status.includes("PERSISTENCE")).length;
  const failed = rows.filter((r) => r.status.startsWith("FAIL")).length;
  const summary = { sha, routes: ROUTES.length, rows: rows.length, exercised, failed, httpErrorSample: httpErrors.slice(0, 20) };
  writeFileSync(join(ARTIFACT_DIR, "exercise-summary.json"), JSON.stringify(summary, null, 2));
  appendFileSync(
    MATRIX_PATH,
    `\n## Summary\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
