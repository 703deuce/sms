/**
 * Transovo — lightweight screenshot capture (dev server only; no production build).
 *
 * Prereq: app already running with DEV_AUTH_BYPASS=1 on the dev server.
 *
 * Examples:
 *   npx tsx scripts/capture-pass-3-visual-proof.ts --route /voice/receptionist --desktop-only
 *   npx tsx scripts/capture-pass-3-visual-proof.ts --group voice-config
 *   npx tsx scripts/capture-pass-3-visual-proof.ts --group mctb-setup --batch-size 3
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const OUT_ROOT =
  process.env.CAPTURE_OUT_ROOT?.trim() || "/opt/cursor/artifacts/screenshots/transovo-ui";
const AUTH_EMAIL =
  process.env.DEV_AUTH_BYPASS_EMAIL?.trim() ||
  process.env.UI_AGENT_SMOKE_EMAIL?.trim() ||
  "alex@harborhome.co";

const NAV_MS = Number(process.env.CAPTURE_NAV_TIMEOUT_MS || 20_000);
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

export type RouteEntry = {
  family: "Voice" | "MCTB";
  slug: string;
  path: string;
  groups: string[];
  /** Playwright locator hint for "ready" (role+name regex or css). */
  ready?: { role: "heading"; name: RegExp } | { css: string };
};

/** Full canonical manifest — filter with --route / --group; never required to capture all at once. */
export const ROUTE_MANIFEST: RouteEntry[] = [
  { family: "Voice", slug: "overview", path: "/voice/overview", groups: ["voice-operational", "voice"], ready: { role: "heading", name: /overview/i } },
  { family: "Voice", slug: "calls", path: "/voice/calls", groups: ["voice-operational", "voice"], ready: { role: "heading", name: /calls/i } },
  { family: "Voice", slug: "call_detail", path: "/voice/calls/__CALL_ID__", groups: ["voice-operational", "voice"], ready: { css: "main" } },
  { family: "Voice", slug: "receptionist", path: "/voice/receptionist", groups: ["voice-config", "voice"], ready: { role: "heading", name: /receptionist/i } },
  { family: "Voice", slug: "knowledge", path: "/voice/knowledge", groups: ["voice-config", "voice"], ready: { role: "heading", name: /business knowledge/i } },
  { family: "Voice", slug: "call_handling", path: "/voice/call-handling", groups: ["voice-config", "voice"], ready: { role: "heading", name: /call handling/i } },
  { family: "Voice", slug: "analytics", path: "/voice/analytics", groups: ["voice-operational", "voice"], ready: { role: "heading", name: /analytics/i } },
  { family: "MCTB", slug: "overview", path: "/mctb", groups: ["mctb-operational", "mctb"], ready: { role: "heading", name: /overview/i } },
  { family: "MCTB", slug: "missed_calls", path: "/mctb/missed-calls", groups: ["mctb-operational", "mctb"], ready: { role: "heading", name: /missed calls/i } },
  { family: "MCTB", slug: "missed_call_detail", path: "/mctb/missed-calls/__MISSED_ID__", groups: ["mctb-operational", "mctb"], ready: { css: "main" } },
  { family: "MCTB", slug: "conversations", path: "/mctb/conversations", groups: ["mctb-operational", "mctb"], ready: { css: "main" } },
  { family: "MCTB", slug: "ai_recovery", path: "/mctb/ai-recovery", groups: ["mctb-operational", "mctb"], ready: { role: "heading", name: /ai recovery/i } },
  { family: "MCTB", slug: "voicemail", path: "/mctb/voicemail", groups: ["mctb-operational", "mctb"], ready: { role: "heading", name: /voicemail/i } },
  { family: "MCTB", slug: "analytics", path: "/mctb/analytics", groups: ["mctb-operational", "mctb"], ready: { role: "heading", name: /analytics/i } },
  { family: "MCTB", slug: "setup", path: "/mctb/setup", groups: ["mctb-setup", "mctb"], ready: { role: "heading", name: /setup/i } },
  { family: "MCTB", slug: "setup_phone", path: "/mctb/setup/phone", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_consent", path: "/mctb/setup/consent", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_text_back", path: "/mctb/setup/text-back", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_recovery", path: "/mctb/setup/recovery", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_voicemail", path: "/mctb/setup/voicemail", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_notifications", path: "/mctb/setup/notifications", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_exclusions", path: "/mctb/setup/exclusions", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_links", path: "/mctb/setup/links", groups: ["mctb-setup", "mctb"] },
  { family: "MCTB", slug: "setup_test", path: "/mctb/setup/test", groups: ["mctb-setup", "mctb"] },
];

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseFlags() {
  const route = argValue("--route");
  const group = argValue("--group");
  const desktopOnly = process.argv.includes("--desktop-only");
  const mobileOnly = process.argv.includes("--mobile-only");
  const closeBrowserEach = process.argv.includes("--close-browser-each-route");
  const batchSize = Number(argValue("--batch-size") || "0") || 0;
  const writeIndex = process.argv.includes("--write-index");
  const phase = argValue("--phase") === "before" ? "before" : "after";
  return { route, group, desktopOnly, mobileOnly, closeBrowserEach, batchSize, writeIndex, phase };
}

async function assertServerUp() {
  const url = `${BASE_URL}/api/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`health ${res.status}`);
  } catch (e) {
    throw new Error(
      `App not reachable at ${BASE_URL} (${e instanceof Error ? e.message : e}). ` +
        `Start dev only: DEV_AUTH_BYPASS=1 DEV_AUTH_BYPASS_EMAIL=${AUTH_EMAIL} npm run dev — do not run next build for screenshots.`,
    );
  }
}

async function onLoginPage(page: Page): Promise<boolean> {
  if (page.url().includes("/login")) return true;
  return page.getByRole("heading", { name: /welcome back/i }).isVisible().catch(() => false);
}

async function authenticate(page: Page) {
  const bypassUrl = `${BASE_URL}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent("/voice/overview")}`;
  const res = await page.goto(bypassUrl, { waitUntil: "domcontentloaded", timeout: NAV_MS });
  if (res?.status() === 404) {
    throw new Error("dev-bypass 404 — set DEV_AUTH_BYPASS=1 on the running dev server.");
  }
  if (await onLoginPage(page)) {
    throw new Error("Still on login after dev-bypass.");
  }
}

async function waitReady(page: Page, entry: RouteEntry) {
  const timeout = NAV_MS;
  if (entry.ready?.role === "heading") {
    await page.getByRole("heading", { name: entry.ready.name }).first().waitFor({ state: "visible", timeout });
    return;
  }
  if (entry.ready?.css) {
    await page.locator(entry.ready.css).first().waitFor({ state: "visible", timeout });
    return;
  }
  await page.waitForLoadState("domcontentloaded", { timeout });
}

async function resolveIds(page: Page) {
  let callId = "demo-call-1";
  let missedId = "unknown";
  try {
    const res = await page.request.get(`${BASE_URL}/api/voice/calls?limit=1`);
    if (res.ok()) {
      const j = await res.json();
      const id = Array.isArray(j.data) ? j.data[0]?.id : undefined;
      if (id) callId = id;
    }
  } catch {
    /* optional */
  }
  try {
    const res = await page.request.get(`${BASE_URL}/api/mctb/missed-calls?limit=1`);
    if (res.ok()) {
      const j = await res.json();
      const id = j?.data?.events?.[0]?.id;
      if (id) missedId = id;
    }
  } catch {
    /* optional */
  }
  return { callId, missedId };
}

function materializePath(path: string, ids: { callId: string; missedId: string }) {
  return path.replace("__CALL_ID__", ids.callId).replace("__MISSED_ID__", ids.missedId);
}

function selectRoutes(): RouteEntry[] {
  const { route, group } = parseFlags();
  if (route) {
    const normalized = route.startsWith("/") ? route : `/${route}`;
    const hit = ROUTE_MANIFEST.filter((r) => r.path === normalized);
    if (hit.length) return hit;
    return [
      {
        family: normalized.includes("mctb") ? "MCTB" : "Voice",
        slug: normalized.replace(/^\//, "").replace(/\//g, "_"),
        path: normalized,
        groups: [],
      },
    ];
  }
  if (group) {
    const list = ROUTE_MANIFEST.filter((r) => r.groups.includes(group));
    if (!list.length) throw new Error(`Unknown group "${group}". Try: voice-config, voice-operational, mctb-setup, mctb-operational, voice, mctb`);
    return list;
  }
  throw new Error("Specify --route /path or --group name (not the full manifest in one run).");
}

async function captureOne(
  page: Page,
  entry: RouteEntry,
  path: string,
  outDir: string,
  opts: { desktopOnly: boolean; mobileOnly: boolean },
) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
  if (await onLoginPage(page)) throw new Error("login page");
  await waitReady(page, entry);

  const dir = join(outDir, entry.family);
  mkdirSync(dir, { recursive: true });
  const files: string[] = [];

  if (!opts.mobileOnly) {
    await page.setViewportSize(DESKTOP);
    const f = join(dir, `${entry.slug}_desktop.png`);
    await page.screenshot({ path: f, fullPage: false });
    files.push(f);
  }
  if (!opts.desktopOnly) {
    await page.setViewportSize(MOBILE);
    const f = join(dir, `${entry.slug}_mobile.png`);
    await page.screenshot({ path: f, fullPage: false });
    files.push(f);
  }
  return files;
}

async function runBatch(routes: RouteEntry[], outDir: string) {
  const flags = parseFlags();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await authenticate(page);
  const ids = await resolveIds(page);

  const captured: string[] = [];
  for (const entry of routes) {
    const path = materializePath(entry.path, ids);
    const t0 = Date.now();
    try {
      const files = await captureOne(page, entry, path, outDir, flags);
      captured.push(...files);
      console.log(`✓ ${path} (${((Date.now() - t0) / 1000).toFixed(1)}s) → ${files.join(", ")}`);
    } catch (e) {
      console.warn(`⚠ ${path}:`, e instanceof Error ? e.message : e);
    }
  }

  await page.close();
  await context.close();
  await browser.close();
  return captured;
}

function writeIndexHtml(outDir: string, files: string[]) {
  const rows = files
    .map((f) => `<tr><td><code>${f.replace(outDir, "")}</code></td><td><img src="${f.replace(outDir, "")}" loading="lazy" /></td></tr>`)
    .join("\n");
  writeFileSync(
    join(outDir, "index.html"),
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transovo UI captures</title></head><body><table>${rows}</table></body></html>`,
  );
}

async function main() {
  await assertServerUp();
  const flags = parseFlags();
  const routes = selectRoutes();
  const outDir = join(OUT_ROOT, flags.phase);
  mkdirSync(outDir, { recursive: true });

  const batchSize = flags.batchSize > 0 ? flags.batchSize : routes.length;
  const allFiles: string[] = [];
  const t0 = Date.now();

  for (let i = 0; i < routes.length; i += batchSize) {
    const chunk = routes.slice(i, i + batchSize);
    console.log(`Batch ${i / batchSize + 1}: ${chunk.map((r) => r.path).join(", ")}`);
    const files = await runBatch(chunk, outDir);
    allFiles.push(...files);
    if (flags.closeBrowserEach || batchSize < routes.length) {
      /* runBatch already closes browser each call */
    }
  }

  if (flags.writeIndex) writeIndexHtml(outDir, allFiles);

  console.log(
    `Done ${allFiles.length} file(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outDir} (no build, concurrency=1)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
