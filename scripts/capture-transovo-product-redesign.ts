/**
 * Product-wide Voice + MCTB screenshot library + HTML index.
 *
 * Prereq: DEV_AUTH_BYPASS=1 DEV_AUTH_BYPASS_EMAIL=... npm run dev  (or next start)
 *   npx tsx scripts/capture-transovo-product-redesign.ts
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const EMAIL =
  process.env.DEV_AUTH_BYPASS_EMAIL?.trim() ||
  process.env.UI_AGENT_SMOKE_EMAIL?.trim() ||
  "alex@harborhome.co";
const ROOT = "/opt/cursor/artifacts/screenshots/transovo-product-redesign";
const NAV_MS = Number(process.env.CAPTURE_NAV_TIMEOUT_MS || 25_000);
const SETTLE_MS = Number(process.env.CAPTURE_SETTLE_MS || 800);
const BEFORE_BASELINE = "/opt/cursor/artifacts/screenshots/pass-3-verified-good";

type RouteDef = { product: "voice" | "mctb"; slug: string; path: string; dynamic?: boolean };

const CANONICAL: RouteDef[] = [
  { product: "voice", slug: "overview", path: "/voice/overview" },
  { product: "voice", slug: "calls", path: "/voice/calls" },
  { product: "voice", slug: "call-detail", path: "/voice/calls/__CALL_ID__", dynamic: true },
  { product: "voice", slug: "receptionist", path: "/voice/receptionist" },
  { product: "voice", slug: "knowledge", path: "/voice/knowledge" },
  { product: "voice", slug: "call-handling", path: "/voice/call-handling" },
  { product: "voice", slug: "analytics", path: "/voice/analytics" },
  { product: "mctb", slug: "overview", path: "/mctb" },
  { product: "mctb", slug: "missed-calls", path: "/mctb/missed-calls" },
  { product: "mctb", slug: "missed-call-detail", path: "/mctb/missed-calls/__MISSED_ID__", dynamic: true },
  { product: "mctb", slug: "conversations", path: "/mctb/conversations" },
  { product: "mctb", slug: "ai-recovery", path: "/mctb/ai-recovery" },
  { product: "mctb", slug: "voicemail", path: "/mctb/voicemail" },
  { product: "mctb", slug: "analytics", path: "/mctb/analytics" },
  { product: "mctb", slug: "setup", path: "/mctb/setup" },
  { product: "mctb", slug: "setup-phone", path: "/mctb/setup/phone" },
  { product: "mctb", slug: "setup-consent", path: "/mctb/setup/consent" },
  { product: "mctb", slug: "setup-text-back", path: "/mctb/setup/text-back" },
  { product: "mctb", slug: "setup-recovery", path: "/mctb/setup/recovery" },
  { product: "mctb", slug: "setup-voicemail", path: "/mctb/setup/voicemail" },
  { product: "mctb", slug: "setup-notifications", path: "/mctb/setup/notifications" },
  { product: "mctb", slug: "setup-exclusions", path: "/mctb/setup/exclusions" },
  { product: "mctb", slug: "setup-links", path: "/mctb/setup/links" },
  { product: "mctb", slug: "setup-test", path: "/mctb/setup/test" },
];

async function isLogin(page: Page) {
  if (page.url().includes("/login")) return true;
  return page.getByRole("heading", { name: /welcome back/i }).isVisible().catch(() => false);
}

async function auth(page: Page) {
  const url = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(EMAIL)}&next=${encodeURIComponent("/voice/overview")}`;
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_MS });
  if (res?.status() === 404) {
    throw new Error("dev-bypass 404 — set DEV_AUTH_BYPASS=1 on the server.");
  }
  if (await isLogin(page)) throw new Error("Auth failed — still on login.");
}

async function resolveDynamicPaths(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const callsRes = await page.request.get(`${BASE}/api/voice/calls?limit=1`);
    if (callsRes.ok()) {
      const json = await callsRes.json();
      const rows = json?.data;
      const id = Array.isArray(rows) ? rows[0]?.id : undefined;
      if (typeof id === "string" && id) out.__CALL_ID__ = id;
    }
  } catch {
    /* optional */
  }
  try {
    const mcRes = await page.request.get(`${BASE}/api/mctb/missed-calls?limit=1`);
    if (mcRes.ok()) {
      const json = await mcRes.json();
      const id = json?.data?.events?.[0]?.id;
      if (typeof id === "string" && id) out.__MISSED_ID__ = id;
    }
  } catch {
    /* optional */
  }
  return out;
}

function materializePath(path: string, dyn: Record<string, string>): string {
  let p = path;
  for (const [key, val] of Object.entries(dyn)) {
    p = p.replace(key, val);
  }
  if (p.includes("__")) return path.replace(/\/__[^/]+__/g, "");
  return p;
}

async function shot(page: Page, dir: string, name: string) {
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(dir, `${name}_desktop.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(dir, `${name}_mobile.png`) });
}

async function waitForServer(maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("server not healthy");
}

async function captureRoute(page: Page, r: RouteDef, phase: "after" | "before", path: string) {
  const out = join(ROOT, phase, r.product);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await waitForServer();
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
      if (SETTLE_MS) await page.waitForTimeout(SETTLE_MS);
      if (await isLogin(page)) throw new Error("login");
      await shot(page, out, r.slug);
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

function seedBeforeFromBaseline(entries: Array<{ r: RouteDef; desktop: string; mobile: string }>) {
  const map: Record<string, string> = {
    "voice/calls": "calls_desktop.png",
    "voice/call-detail": "call_detail_desktop.png",
    "mctb/overview": "overview_desktop.png",
  };
  mkdirSync(join(ROOT, "before"), { recursive: true });
  for (const e of entries) {
    const key = `${e.r.product}/${e.r.slug}`;
    const baseFile = map[key];
    if (!baseFile) continue;
    const src = join(BEFORE_BASELINE, baseFile);
    if (!existsSync(src)) continue;
    const destDir = join(ROOT, "before", e.r.product);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(src, join(destDir, `${e.r.slug}_desktop.png`));
    copyFileSync(src, join(destDir, `${e.r.slug}_mobile.png`));
  }
}

function writeIndex(
  entries: Array<{ r: RouteDef; path: string; desktop: string; mobile: string; error?: string }>,
) {
  const rows = entries
    .map((e) => {
      const beforeD = join(ROOT, "before", e.r.product, `${e.r.slug}_desktop.png`);
      const beforeM = join(ROOT, "before", e.r.product, `${e.r.slug}_mobile.png`);
      const afterD = e.desktop.replace(ROOT, "");
      const afterM = e.mobile.replace(ROOT, "");
      const beforeDRel = existsSync(beforeD) ? beforeD.replace(ROOT, "") : "";
      const beforeMRel = existsSync(beforeM) ? beforeM.replace(ROOT, "") : "";
      const err = e.error ? `<p class="err">${e.error}</p>` : "";
      return `<tr>
        <td>${e.r.product}</td>
        <td><code>${e.path}</code></td>
        <td>${beforeDRel ? `<img src="${beforeDRel}" alt="before desktop" loading="lazy" />` : "—"}</td>
        <td>${err || `<img src="${afterD}" alt="after desktop" loading="lazy" />`}</td>
        <td>${beforeMRel ? `<img src="${beforeMRel}" alt="before mobile" loading="lazy" />` : "—"}</td>
        <td>${err || `<img src="${afterM}" alt="after mobile" loading="lazy" />`}</td>
      </tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Transovo product redesign</title>
<style>
body{font-family:system-ui,sans-serif;margin:1.5rem;background:#f8f9fa;color:#111}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
th,td{border:1px solid #e5e7eb;padding:.5rem;vertical-align:top}
img{max-width:min(420px,100%);height:auto;border:1px solid #eceef1}
.err{color:#b91c1c;font-size:13px}
code{font-size:11px}
</style></head><body>
<h1>Transovo — product redesign captures</h1>
<p>Generated ${new Date().toISOString()} · base ${BASE} · auth ${EMAIL}</p>
<table><thead><tr><th>Product</th><th>Route</th><th>Before desktop</th><th>After desktop</th><th>Before mobile</th><th>After mobile</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  writeFileSync(join(ROOT, "index.html"), html);
}

async function main() {
  const phaseOnlyBefore = process.argv.includes("--before");
  const phase = phaseOnlyBefore ? "before" : "after";
  mkdirSync(join(ROOT, phase), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const t0 = Date.now();
  await auth(page);
  const dyn = await resolveDynamicPaths(page);

  const entries: Array<{ r: RouteDef; path: string; desktop: string; mobile: string; error?: string }> =
    [];
  const only = process.env.CAPTURE_ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
  const routes = only?.length ? CANONICAL.filter((r) => only.includes(r.slug)) : CANONICAL;

  for (const r of routes) {
    const path = materializePath(r.path, dyn);
    const out = join(ROOT, phase, r.product);
    const desktop = join(out, `${r.slug}_desktop.png`);
    const mobile = join(out, `${r.slug}_mobile.png`);
    try {
      await captureRoute(page, r, phase, path);
      entries.push({ r, path, desktop, mobile });
      console.log(`✓ ${r.product}/${r.slug} → ${path}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      entries.push({ r, path, desktop, mobile, error: msg });
      console.warn(`⚠ ${path}: ${msg}`);
    }
  }
  await browser.close();
  if (!phaseOnlyBefore) seedBeforeFromBaseline(entries);
  writeIndex(entries);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${sec}s → ${ROOT}/index.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
