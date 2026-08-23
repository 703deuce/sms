/**
 * Browser: smoke-login cert user → MCTB onboarding → Start demo.
 *
 * Usage:
 *   node scripts/mctb-cert-start-demo-ui.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL || "")
  .replace(/\/$/, "");
const EMAIL =
  process.env.CERT_OWNER_EMAIL?.trim() ||
  "mctb-cert+mctb-cert-pass1-mt3m55ds@transovo-cert.internal";
const WORKSPACE_ID = process.env.CERT_WORKSPACE_ID || "cmt3m55zl0p2f5o1l16604i73";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts/mctb-cert-demo";
const REPORT = `${OUT_DIR}/start-demo-ui.json`;

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  base: BASE,
  email: EMAIL,
  workspaceId: WORKSPACE_ID,
  startedAt: new Date().toISOString(),
  ok: false,
  steps: [],
  errors: [],
};

function log(step, detail = {}) {
  const row = { step, at: new Date().toISOString(), ...detail };
  report.steps.push(row);
  console.log(`→ ${step}`, detail.message || detail.status || "");
}

if (!BASE) {
  console.error("APP_URL / NEXT_PUBLIC_APP_URL / BASE_URL required");
  process.exit(1);
}

async function shot(page, name) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  const loginRes = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok()) {
    throw new Error(`smoke-login ${loginRes.status()}: ${JSON.stringify(loginBody)}`);
  }
  log("smoke-login", { status: loginRes.status(), workspaceName: loginBody.workspaceName });

  await page.goto(`${BASE}/onboarding/mctb`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, "01-onboarding");

  const bodyText = await page.locator("body").innerText();
  report.pageSnippet = bodyText.slice(0, 500);
  log("onboarding-loaded", { hasDemoStep: /See how it works|start demo/i.test(bodyText) });

  const startBtn = page.getByRole("button", { name: /start demo/i });
  await startBtn.waitFor({ state: "visible", timeout: 30000 });
  await shot(page, "02-before-start-demo");

  const demoPost = page.waitForResponse(
    (res) => res.url().includes("/api/mctb/demo") && res.request().method() === "POST",
    { timeout: 30000 },
  );
  await startBtn.click();
  const demoRes = await demoPost;
  const demoJson = await demoRes.json().catch(() => ({}));
  log("demo-post", { status: demoRes.status(), body: demoJson });
  if (!demoRes.ok()) {
    throw new Error(`POST /api/mctb/demo failed: ${JSON.stringify(demoJson)}`);
  }

  await page.waitForTimeout(2500);
  await shot(page, "03-after-start-demo");

  const statusRes = await page.request.get(`${BASE}/api/mctb/demo`);
  const statusJson = await statusRes.json().catch(() => ({}));
  report.demoStatus = statusJson.data || statusJson;
  log("demo-status", { sessionStatus: statusJson.data?.session?.status });

  report.ok = Boolean(statusJson.data?.session?.status === "waiting_call");
  if (!report.ok) {
    report.errors.push("Demo session not in waiting_call after start");
  }
} catch (err) {
  report.errors.push(err instanceof Error ? err.message : String(err));
  await shot(page, "error").catch(() => undefined);
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
