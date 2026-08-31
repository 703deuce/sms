/**
 * Deep verification screenshots for Kimi wired pages — list views AND
 * the sub-pages users actually work in (builders, wizards, thread, etc.).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import type { WalkthroughStep } from "./polish-targets";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3456";
const OUT = "/opt/cursor/artifacts/kimi-wired-pages-deep";
const FIXTURE_CSV = join(process.cwd(), "scripts/ui-agent/fixtures/sample-contacts-import.csv");

type WalkthroughAction =
  | { type: "wait"; ms: number }
  | { type: "click"; selector: string }
  | { type: "scroll"; y: number };

async function authenticate(page: Page, nextPath: string) {
  const bypass = `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent(nextPath)}`;
  await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
}

async function runActions(page: Page, actions: WalkthroughAction[] = []) {
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
          await loc.click({ timeout: 10000 });
          break;
        }
      }
      await page.waitForTimeout(500);
    }
  }
}

async function captureStep(page: Page, step: WalkthroughStep): Promise<string | null> {
  const url = `${BASE}${step.path.startsWith("/") ? step.path : `/${step.path}`}`;
  console.log(`  → ${step.id}: ${step.label}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  await runActions(page, step.actions);
  const file = join(OUT, `${step.id}.png`);
  await page.screenshot({ path: file, fullPage: step.fullPage !== false });
  console.log(`    OK ${file}`);
  return file;
}

/** Import wizard: upload CSV → columns mapping step */
async function captureImportColumns(page: Page): Promise<string | null> {
  const id = "contacts-03-import-columns";
  console.log(`  → ${id}: Import wizard — assign columns`);
  await page.goto(`${BASE}/contacts/imports`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(700);
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(FIXTURE_CSV);
  await page.waitForTimeout(500);
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(1000);
  const file = join(OUT, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`    OK ${file}`);
  return file;
}

const DEEP_STEPS: WalkthroughStep[] = [
  { id: "conversations-01-inbox", label: "Inbox overview", path: "/conversations", fullPage: true },
  {
    id: "conversations-02-thread",
    label: "Thread + contact panel",
    path: "/conversations",
    actions: [
      { type: "click", selector: ".tv-convo-row" },
      { type: "wait", ms: 1200 },
    ],
    fullPage: true,
  },
  {
    id: "conversations-03-compose",
    label: "New message compose modal",
    path: "/conversations",
    actions: [
      { type: "click", selector: 'button:has-text("New Message")' },
      { type: "wait", ms: 800 },
    ],
    fullPage: true,
  },

  { id: "campaigns-01-list", label: "Campaigns list", path: "/campaigns", fullPage: true },
  { id: "campaigns-02-compose", label: "Create campaign composer", path: "/campaigns/new", fullPage: true },
  { id: "campaigns-03-review", label: "Launch review", path: "/campaigns/new/review", fullPage: true },

  { id: "contacts-01-list", label: "Contacts list", path: "/contacts", fullPage: true },
  {
    id: "contacts-02-create",
    label: "Create contact form",
    path: "/contacts",
    actions: [
      { type: "click", selector: 'button:has-text("Create Contact")' },
      { type: "wait", ms: 500 },
      { type: "click", selector: 'button:has-text("Create One")' },
      { type: "wait", ms: 1000 },
    ],
    fullPage: true,
  },
  { id: "contacts-03-import-upload", label: "Import wizard — upload", path: "/contacts/imports", fullPage: true },

  { id: "lists-01-page", label: "Lists overview", path: "/contacts/lists", fullPage: true },
  {
    id: "lists-02-create",
    label: "Create list form",
    path: "/contacts/lists",
    actions: [
      { type: "click", selector: 'button:has-text("Create List")' },
      { type: "wait", ms: 1000 },
    ],
    fullPage: true,
  },
  {
    id: "lists-03-contacts-tab",
    label: "Lists — contacts tab",
    path: "/contacts/lists",
    actions: [
      { type: "click", selector: '.page-tab:has-text("Contacts")' },
      { type: "wait", ms: 1000 },
    ],
    fullPage: true,
  },

  { id: "fields-01-list", label: "Custom fields list", path: "/contacts/fields", fullPage: true },
  {
    id: "fields-02-create",
    label: "Create custom field",
    path: "/contacts/fields",
    actions: [
      { type: "click", selector: 'button:has-text("Create Field")' },
      { type: "wait", ms: 1000 },
    ],
    fullPage: true,
  },

  { id: "segments-01-list", label: "Segments list", path: "/contacts/segments", fullPage: true },
  {
    id: "segments-02-builder",
    label: "Segment condition builder",
    path: "/contacts/segments",
    actions: [
      { type: "click", selector: 'button:has-text("Create Segment")' },
      { type: "wait", ms: 1200 },
    ],
    fullPage: true,
  },

  { id: "grow-keywords-01-list", label: "Keywords list", path: "/grow/keywords", fullPage: true },
  {
    id: "grow-keywords-02-builder",
    label: "Keyword builder",
    path: "/grow/keywords",
    actions: [
      { type: "click", selector: 'button:has-text("Create Keyword")' },
      { type: "wait", ms: 1200 },
    ],
    fullPage: true,
  },

  { id: "grow-qr-01-list", label: "QR keywords list", path: "/grow/qr-codes", fullPage: true },
  {
    id: "grow-qr-02-generator",
    label: "QR code generator",
    path: "/grow/qr-codes",
    actions: [
      { type: "click", selector: 'button:has-text("Create Keyword")' },
      { type: "wait", ms: 1200 },
    ],
    fullPage: true,
  },

  { id: "tap-join-01-links", label: "Tap-to-join links list", path: "/grow/tap-to-join", fullPage: true },
  {
    id: "tap-join-02-create",
    label: "Create tap-to-join link",
    path: "/grow/tap-to-join",
    actions: [
      { type: "click", selector: 'button:has-text("Create Link")' },
      { type: "wait", ms: 1200 },
    ],
    fullPage: true,
  },

  { id: "forms-01-list", label: "Web forms list", path: "/grow/forms", fullPage: true },
  {
    id: "forms-02-builder",
    label: "Form builder canvas",
    path: "/grow/forms",
    actions: [
      { type: "click", selector: 'button:has-text("Create Web Form")' },
      { type: "wait", ms: 2500 },
    ],
    fullPage: true,
  },

  { id: "auto-replies-01-overview", label: "Auto-replies overview", path: "/auto-replies", fullPage: true },
  {
    id: "auto-replies-02-optin",
    label: "Opt-in messages",
    path: "/auto-replies",
    actions: [
      { type: "click", selector: 'button:has-text("Opt-In Messages")' },
      { type: "wait", ms: 800 },
    ],
    fullPage: true,
  },
  {
    id: "auto-replies-03-compliance",
    label: "Compliance messaging",
    path: "/auto-replies",
    actions: [
      { type: "click", selector: 'button:has-text("Compliance")' },
      { type: "wait", ms: 800 },
    ],
    fullPage: true,
  },
  {
    id: "auto-replies-04-keywords",
    label: "Auto-reply keywords list",
    path: "/auto-replies",
    actions: [
      { type: "click", selector: 'button:has-text("Keywords")' },
      { type: "wait", ms: 800 },
    ],
    fullPage: true,
  },
  {
    id: "auto-replies-06-inbox",
    label: "Inbox auto-response settings",
    path: "/auto-replies",
    actions: [
      { type: "click", selector: 'button:has-text("Inbox Auto-Response")' },
      { type: "wait", ms: 800 },
    ],
    fullPage: true,
  },

  { id: "media-01-list", label: "MMS campaigns list", path: "/messaging/media", fullPage: true },
  { id: "media-02-compose", label: "MMS campaign composer", path: "/messaging/media?create=1", fullPage: true },

  { id: "automations-01-flows", label: "Automations flows list", path: "/automations", fullPage: true },
  {
    id: "automations-02-builder",
    label: "Workflow builder",
    path: "/automations",
    actions: [
      { type: "click", selector: "table tbody tr" },
      { type: "wait", ms: 4000 },
    ],
    fullPage: true,
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await authenticate(page, "/dashboard");

  const results: string[] = [];
  const failures: string[] = [];

  for (const step of DEEP_STEPS) {
    try {
      const path = await captureStep(page, step);
      if (path) results.push(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`    FAIL ${step.id}: ${msg.split("\n")[0]}`);
      failures.push(step.id);
    }
  }

  try {
    const importPath = await captureImportColumns(page);
    if (importPath) results.push(importPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    FAIL contacts-03-import-columns: ${msg.split("\n")[0]}`);
    failures.push("contacts-03-import-columns");
  }

  await browser.close();

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ captured: results, failures, capturedAt: new Date().toISOString() }, null, 2),
  );

  console.log(`\nDone: ${results.length} captured, ${failures.length} failed → ${OUT}`);
  if (failures.length) console.log("Failures:", failures.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
