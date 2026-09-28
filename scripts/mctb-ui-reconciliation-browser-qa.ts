/**
 * MCTB UI reconciliation — responsive overflow + horizontal tab sanity checks.
 * Run: UI_AGENT_BASE_URL=http://127.0.0.1:3010 DEV_AUTH_BYPASS=1 npx tsx scripts/mctb-ui-reconciliation-browser-qa.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3010";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/mctb-reconciliation-qa";

const WIDTHS = [1440, 1280, 768, 390] as const;

const ROUTES: Array<{ path: string; tabCheck?: boolean }> = [
  { path: "/mctb" },
  { path: "/mctb/missed-calls" },
  { path: "/mctb/conversations" },
  { path: "/mctb/voicemail?tab=messages" },
  { path: "/mctb/voicemail?tab=greeting", tabCheck: true },
  { path: "/mctb/analytics" },
  { path: "/mctb/missed-call-recovery?tab=general", tabCheck: true },
  { path: "/mctb/missed-call-recovery?tab=rules", tabCheck: true },
  { path: "/mctb/missed-call-recovery?tab=consent", tabCheck: true },
  { path: "/mctb/missed-call-recovery?tab=exclusions", tabCheck: true },
  { path: "/mctb/text-back" },
  { path: "/mctb/ai-recovery" },
  { path: "/mctb/notifications" },
  { path: "/mctb/phone" },
  { path: "/mctb/compliance/consent" },
];

type Row = {
  route: string;
  width: number;
  overflowPx: number;
  tabVertical: boolean | null;
  ok: boolean;
  error?: string;
};

async function measure(page: Page, tabCheck: boolean): Promise<{ overflowPx: number; tabVertical: boolean | null }> {
  const overflowPx = await page.evaluate(() => {
    const el = document.documentElement;
    return Math.max(0, el.scrollWidth - el.clientWidth);
  });

  let tabVertical: boolean | null = null;
  if (tabCheck) {
    tabVertical = await page.evaluate(() => {
      const list = document.querySelector('[data-slot="tabs-list"]') as HTMLElement | null;
      const trigger = document.querySelector('[data-slot="tabs-trigger"]') as HTMLElement | null;
      if (!list || !trigger) return false;
      const listRect = list.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      return listRect.height > triggerRect.height * 2.5 && listRect.width < triggerRect.height;
    });
  }

  return { overflowPx, tabVertical };
}

async function gotoWithRetry(page: Page, url: string) {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(600);
      return;
    } catch (e) {
      last = e;
      await page.waitForTimeout(2000);
    }
  }
  throw last;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await gotoWithRetry(
    page,
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb")}`,
  );

  const rows: Row[] = [];
  let failures = 0;

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    for (const { path, tabCheck } of ROUTES) {
      const route = path;
      try {
        await gotoWithRetry(page, `${BASE}${path}`);
        const { overflowPx, tabVertical } = await measure(page, Boolean(tabCheck));
        const ok = overflowPx <= 2 && tabVertical !== true;
        if (!ok) failures += 1;
        rows.push({ route, width, overflowPx, tabVertical, ok });
        const slug = `${width}_${route.replace(/[^a-z0-9]+/gi, "_")}`.slice(0, 120);
        await page.screenshot({ path: join(OUT, `${slug}.png`), fullPage: false });
      } catch (e) {
        failures += 1;
        rows.push({
          route,
          width,
          overflowPx: -1,
          tabVertical: null,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  writeFileSync(join(OUT, "report.json"), JSON.stringify({ failures, rows }, null, 2));
  await browser.close();

  console.log(`mctb-ui-reconciliation-browser-qa: ${failures} failure(s), report → ${OUT}/report.json`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
