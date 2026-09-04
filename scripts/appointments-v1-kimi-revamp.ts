#!/usr/bin/env tsx
/**
 * Appointments V1 full UI revamp — Cursor orchestrates Kimi Mode 3.
 *
 * Workflow per screen: capture screenshot → Kimi polish (apply) → recapture verify
 *
 *   npx tsx scripts/appointments-v1-kimi-revamp.ts inventory
 *   DEV_AUTH_BYPASS=1 npx tsx scripts/appointments-v1-kimi-revamp.ts capture --batch 1
 *   npx tsx scripts/appointments-v1-kimi-revamp.ts kimi --batch 1 --concurrency 10 --stagger-ms 10000
 *   DEV_AUTH_BYPASS=1 npx tsx scripts/appointments-v1-kimi-revamp.ts verify --batch 1
 *   npx tsx scripts/appointments-v1-kimi-revamp.ts status
 *   DEV_AUTH_BYPASS=1 npx tsx scripts/appointments-v1-kimi-revamp.ts run --batch 1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import {
  APPOINTMENTS_V1_KIMI_INSTRUCTION,
  APPOINTMENTS_V1_SCREENS,
  type AppointmentsV1Screen,
  allBatches,
  screensForBatch,
} from "./ui-agent/appointments-v1-screens";
import type { WalkthroughAction } from "./ui-agent/polish-targets";
import { UI_AGENT_DIR } from "./ui-agent/config";

const BATCH_DIR = join(UI_AGENT_DIR, "batch");
const INVENTORY_PATH = join(BATCH_DIR, "appointments-v1-inventory.json");
const JOBS_PATH = join(BATCH_DIR, "appointments-v1-polish-jobs.json");
const SHOTS_DIR = join(UI_AGENT_DIR, "screenshots", "appointments-v1");

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";

export type InventoryRow = {
  id: string;
  route: string;
  path: string;
  label: string;
  area: string;
  batch: number;
  purpose: string;
  screenshotCaptured: boolean;
  screenshotPath?: string;
  sentToKimi: boolean;
  kimiSessionId?: string;
  implementationComplete: boolean;
  browserRechecked: boolean;
  responsiveChecked: boolean;
  notes?: string;
};

export type InventoryFile = {
  updatedAt: string;
  baseUrl: string;
  rows: InventoryRow[];
};

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadInventory(): InventoryFile {
  if (!existsSync(INVENTORY_PATH)) {
    return {
      updatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      rows: APPOINTMENTS_V1_SCREENS.map((s) => ({
        id: s.id,
        route: s.route,
        path: s.path,
        label: s.label,
        area: s.area,
        batch: s.batch,
        purpose: s.purpose,
        screenshotCaptured: false,
        sentToKimi: false,
        implementationComplete: false,
        browserRechecked: false,
        responsiveChecked: s.viewport === "mobile",
      })),
    };
  }
  return JSON.parse(readFileSync(INVENTORY_PATH, "utf8")) as InventoryFile;
}

function saveInventory(inv: InventoryFile): void {
  mkdirSync(BATCH_DIR, { recursive: true });
  inv.updatedAt = new Date().toISOString();
  inv.baseUrl = BASE_URL;
  writeFileSync(INVENTORY_PATH, JSON.stringify(inv, null, 2), "utf8");
}

async function authenticate(page: Page, nextPath: string, useAuth: boolean): Promise<void> {
  if (!useAuth) return;
  const bypass = `${BASE_URL}/api/auth/dev-bypass?next=${encodeURIComponent(nextPath)}`;
  await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
}

async function runActions(page: Page, actions: WalkthroughAction[] = []): Promise<void> {
  for (const action of actions) {
    if (action.type === "wait") {
      await page.waitForTimeout(action.ms);
      continue;
    }
    if (action.type === "scroll") {
      await page.evaluate((y) => window.scrollTo(0, y), action.y);
      await page.waitForTimeout(300);
      continue;
    }
    if (action.type === "click") {
      const selectors = action.selector.split(",").map((s) => s.trim());
      for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
          await loc.click({ timeout: 10_000 }).catch(() => undefined);
          break;
        }
      }
      await page.waitForTimeout(500);
    }
  }
}

type Discovery = {
  appointmentDetailPath?: string;
  contactDetailPath?: string;
  bookingSlug?: string;
};

async function discoverContext(page: Page): Promise<Discovery> {
  const out: Discovery = {};

  try {
    const settings = await page.evaluate(async () => {
      const res = await fetch("/api/appointments/settings");
      if (!res.ok) return null;
      return res.json() as Promise<{ workspace?: { slug?: string } }>;
    });
    if (settings?.workspace?.slug) out.bookingSlug = settings.workspace.slug;
  } catch {
    // ignore
  }

  try {
    await page.goto(`${BASE_URL}/appointments`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1200);
    const hrefs = await page.locator('a[href^="/appointments/"]').evaluateAll((els) =>
      els.map((a) => a.getAttribute("href")).filter(Boolean) as string[],
    );
    const staticPaths = new Set([
      "/appointments/overview",
      "/appointments/calendar",
      "/appointments/types",
      "/appointments/availability",
      "/appointments/reminders",
      "/appointments/booking",
      "/appointments/setup",
      "/appointments/analytics",
      "/appointments/new",
    ]);
    out.appointmentDetailPath = hrefs.find(
      (h) => h.match(/^\/appointments\/[a-zA-Z0-9_-]+$/) && !staticPaths.has(h),
    );
  } catch {
    // ignore
  }

  try {
    await page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1200);
    const hrefs = await page.locator('a[href^="/contacts/"]').evaluateAll((els) =>
      els.map((a) => a.getAttribute("href")).filter(Boolean) as string[],
    );
    const staticContact = new Set([
      "/contacts/lists",
      "/contacts/segments",
      "/contacts/fields",
      "/contacts/imports",
      "/contacts/create",
    ]);
    out.contactDetailPath = hrefs.find(
      (h) => h.match(/^\/contacts\/[a-zA-Z0-9_-]+$/) && !staticContact.has(h),
    );
  } catch {
    // ignore
  }

  return out;
}

function resolveScreenPath(screen: AppointmentsV1Screen, discovery: Discovery): string {
  switch (screen.resolve) {
    case "appointment-detail":
      return discovery.appointmentDetailPath || screen.path;
    case "contact-detail":
      return discovery.contactDetailPath || screen.path;
    case "booking-slug":
      return discovery.bookingSlug ? `/book/${discovery.bookingSlug}` : screen.path;
    case "types-edit":
      return screen.path;
    default:
      return screen.path;
  }
}

async function captureScreen(
  page: Page,
  screen: AppointmentsV1Screen,
  discovery: Discovery,
): Promise<string> {
  const path = resolveScreenPath(screen, discovery);
  const outDir = join(SHOTS_DIR, screen.id);
  mkdirSync(outDir, { recursive: true });
  const viewport =
    screen.viewport === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);

  if (screen.requiresAuth) {
    await authenticate(page, path, true);
  }

  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);

  if (screen.resolve === "types-edit") {
    await runActions(page, [{ type: "click", selector: 'button:has-text("Edit"), button:has-text("New")' }]);
    await page.waitForTimeout(800);
  }

  await runActions(page, screen.actions);

  const shotPath = join(outDir, `${screen.viewport}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  return shotPath;
}

async function cmdInventory(): Promise<void> {
  const inv = loadInventory();
  saveInventory(inv);
  console.log(`\nInventory: ${inv.rows.length} screens across batches ${allBatches().join(", ")}`);
  console.log(`Written: ${INVENTORY_PATH}\n`);
  printStatusTable(inv);
}

function printStatusTable(inv: InventoryFile): void {
  console.log(
    "Route | Screen | Captured | Kimi | Done | Rechecked | Responsive",
  );
  for (const row of inv.rows) {
    console.log(
      `${row.path} | ${row.label} | ${row.screenshotCaptured ? "✓" : "○"} | ${row.sentToKimi ? "✓" : "○"} | ${row.implementationComplete ? "✓" : "○"} | ${row.browserRechecked ? "✓" : "○"} | ${row.responsiveChecked ? "✓" : "○"}`,
    );
  }
}

async function cmdCapture(batch: number): Promise<void> {
  const screens = screensForBatch(batch);
  const inv = loadInventory();
  mkdirSync(SHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await authenticate(page, "/appointments/overview", true);
  const discovery = await discoverContext(page);
  console.log("Discovery:", discovery);

  for (const screen of screens) {
    console.log(`Capturing ${screen.id} (${screen.label})…`);
    try {
      const shotPath = await captureScreen(page, screen, discovery);
      const row = inv.rows.find((r) => r.id === screen.id);
      if (row) {
        row.screenshotCaptured = true;
        row.screenshotPath = shotPath;
        row.path = resolveScreenPath(screen, discovery);
      }
      console.log(`  ✓ ${shotPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ${screen.id}: ${msg}`);
      const row = inv.rows.find((r) => r.id === screen.id);
      if (row) row.notes = `capture failed: ${msg}`;
    }
  }

  await browser.close();
  saveInventory(inv);
  writeJobsFile(inv, batch);
  console.log(`\nBatch ${batch} capture complete. Jobs: ${JOBS_PATH}`);
}

function writeJobsFile(inv: InventoryFile, batch: number): void {
  const jobs = inv.rows
    .filter((r) => r.batch === batch && r.screenshotCaptured && r.screenshotPath)
    .map((r) => ({
      id: r.id,
      path: r.path,
      target: r.path.startsWith("/book/") ? r.path : r.route,
      screenshot: r.screenshotPath!,
      instruction: `${APPOINTMENTS_V1_KIMI_INSTRUCTION}\n\nPage-specific purpose:\n${r.purpose}`,
    }));

  writeFileSync(
    JOBS_PATH,
    JSON.stringify({ instruction: APPOINTMENTS_V1_KIMI_INSTRUCTION, batch, jobs }, null, 2),
    "utf8",
  );
}

async function cmdKimi(batch: number, concurrency: number, staggerMs: number): Promise<void> {
  if (!existsSync(JOBS_PATH)) {
    throw new Error(`Jobs file missing — run capture --batch ${batch} first`);
  }
  const { spawn } = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "tsx",
        "scripts/ui-agent/kimi-screenshot-batch.ts",
        "--jobs",
        JOBS_PATH,
        "--concurrency",
        String(concurrency),
        "--stagger-ms",
        String(staggerMs),
      ],
      {
        stdio: "inherit",
        env: { ...process.env, UI_AGENT_BASE_URL: BASE_URL },
        cwd: process.cwd(),
      },
    );
    child.on("exit", (code) => {
      if (code === 0) {
        const inv = loadInventory();
        for (const row of inv.rows.filter((r) => r.batch === batch)) {
          if (row.screenshotCaptured) {
            row.sentToKimi = true;
            row.implementationComplete = true;
          }
        }
        saveInventory(inv);
        resolve();
      } else reject(new Error(`kimi-screenshot-batch exited ${code}`));
    });
  });
}

async function cmdVerify(batch: number): Promise<void> {
  const screens = screensForBatch(batch);
  const inv = loadInventory();
  const verifyDir = join(SHOTS_DIR, `_after-batch-${batch}`);
  mkdirSync(verifyDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await authenticate(page, "/appointments/overview", true);
  const discovery = await discoverContext(page);

  for (const screen of screens) {
    const row = inv.rows.find((r) => r.id === screen.id);
    if (!row?.implementationComplete) continue;
    console.log(`Recheck ${screen.id}…`);
    try {
      const shotPath = await captureScreen(page, screen, discovery);
      const afterPath = join(verifyDir, `${screen.id}-${screen.viewport}.png`);
      const { copyFileSync } = await import("node:fs");
      copyFileSync(shotPath, afterPath);
      if (row) row.browserRechecked = true;
      console.log(`  ✓ ${afterPath}`);
    } catch (err) {
      console.error(`  ✗ ${screen.id}`, err);
    }
  }

  await browser.close();
  saveInventory(inv);
  console.log(`\nBatch ${batch} verify screenshots → ${verifyDir}`);
}

async function cmdStatus(): Promise<void> {
  const inv = loadInventory();
  printStatusTable(inv);
  const total = inv.rows.length;
  const captured = inv.rows.filter((r) => r.screenshotCaptured).length;
  const kimi = inv.rows.filter((r) => r.sentToKimi).length;
  const done = inv.rows.filter((r) => r.implementationComplete).length;
  const rechecked = inv.rows.filter((r) => r.browserRechecked).length;
  console.log(`\nProgress: ${captured}/${total} captured | ${kimi}/${total} Kimi | ${done}/${total} implemented | ${rechecked}/${total} rechecked`);
}

async function cmdRun(batch: number, concurrency: number, staggerMs: number): Promise<void> {
  await cmdInventory();
  await cmdCapture(batch);
  await cmdKimi(batch, concurrency, staggerMs);
  await cmdVerify(batch);
  await cmdStatus();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || "status";
  const batch = Number(parseArg(args, "--batch") || 1);
  const concurrency = Number(parseArg(args, "--concurrency") || 10);
  const staggerMs = Number(parseArg(args, "--stagger-ms") || 10_000);

  mkdirSync(BATCH_DIR, { recursive: true });

  switch (command) {
    case "inventory":
      await cmdInventory();
      break;
    case "capture":
      await cmdCapture(batch);
      break;
    case "kimi":
      await cmdKimi(batch, concurrency, staggerMs);
      break;
    case "verify":
      await cmdVerify(batch);
      break;
    case "status":
      await cmdStatus();
      break;
    case "run":
      await cmdRun(batch, concurrency, staggerMs);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
