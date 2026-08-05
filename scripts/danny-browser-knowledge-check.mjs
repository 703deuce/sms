/**
 * Browser UX: open live Danny and confirm business knowledge is on the agent.
 *   BASE_URL=https://transovo.ai node scripts/danny-browser-knowledge-check.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/danny-agent";
const AGENT_ID = process.env.AGENT_ID || "cmsgalvos0b4j1o6j3b563w5z";
const FLOW_ID = process.env.FLOW_ID || "cmsgam0u264372y724h443y1y";

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  agentId: AGENT_ID,
  startedAt: new Date().toISOString(),
  ok: false,
  errors: [],
  steps: [],
};

function log(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`→ ${step}`, detail.message || "");
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    const login = await page.request.post(`${BASE}/api/auth/smoke-login`, {
      headers: {
        "content-type": "application/json",
        "x-smoke-bootstrap": BOOTSTRAP,
      },
      data: { email: EMAIL },
    });
    if (!login.ok()) throw new Error(`smoke-login ${login.status()}`);
    log("smoke-login");

    // API proof: prompt must contain Lakeside facts
    const ag = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
    const aj = await ag.json();
    const prompt =
      aj?.data?.draftConfig?.instructions?.system ||
      aj?.data?.publishedConfig?.instructions?.system ||
      "";
    report.prompt = {
      len: prompt.length,
      has189: prompt.includes("$189"),
      hasFriday: /Friday/i.test(prompt),
      hasWifi: /Welcome1847/i.test(prompt),
      hasMaya: /Maya Patel/i.test(prompt),
      hasBusinessKnowledge: /Business knowledge/i.test(prompt),
      hasKbOnly: /knowledge base only/i.test(prompt),
    };
    log("prompt-check", report.prompt);
    for (const [k, need] of [
      ["has189", true],
      ["hasFriday", true],
      ["hasWifi", true],
      ["hasMaya", true],
      ["hasBusinessKnowledge", true],
      ["hasKbOnly", false],
    ]) {
      if (report.prompt[k] !== need) {
        report.errors.push(`prompt ${k}=${report.prompt[k]} expected ${need}`);
      }
    }

    // Browser: open agent builder
    await page.goto(`${BASE}/voice/agents/${AGENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2500);
    await shot(page, "knowledge-01-agent");

    // Open Instructions / Knowledge if present in sidebar
    for (const label of ["Instructions", "Knowledge", "Identity"]) {
      const link = page.getByRole("button", { name: new RegExp(label, "i") }).first();
      const link2 = page.getByText(label, { exact: true }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await page.waitForTimeout(800);
      } else if (await link2.isVisible().catch(() => false)) {
        await link2.click();
        await page.waitForTimeout(800);
      }
    }
    await shot(page, "knowledge-02-section");
    const body = await page.locator("body").innerText();
    report.ui = {
      danny: /Danny/i.test(body),
      lakeside: /Lakeside/i.test(body),
      active: /Active|Live/i.test(body),
      priceOrHours: /\$189|Friday|Welcome1847|Maya Patel/i.test(body),
    };
    log("agent-ui", report.ui);
    if (!report.ui.danny) report.errors.push("UI missing Danny");
    if (!report.ui.active) report.errors.push("UI not Active");

    // Flow diagnostics still live
    await page.goto(`${BASE}/automations/${FLOW_ID}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2500);
    await shot(page, "knowledge-03-flow");
    const diag = await page.request.get(
      `${BASE}/api/automations/${FLOW_ID}/diagnostics`,
    );
    const dj = await diag.json();
    report.diagnostics = {
      deploymentStatus: dj?.data?.deploymentStatus,
      assistantLaunch: dj?.data?.layers?.assistantLaunch,
      telnyxAssistantId: dj?.data?.telnyxAssistantId,
    };
    log("diagnostics", report.diagnostics);
    if (report.diagnostics.deploymentStatus !== "live") {
      report.errors.push("not live after knowledge republish");
    }
    if (report.diagnostics.assistantLaunch !== "ok") {
      report.errors.push("assistant not ok");
    }

    report.callNumber = "+18663464256";
    report.ok = report.errors.length === 0;
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.ok = false;
    await shot(page, "knowledge-fatal").catch(() => null);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      `${OUT}/browser-knowledge-check.json`,
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        errors: report.errors,
        prompt: report.prompt,
        ui: report.ui,
        diagnostics: report.diagnostics,
        callNumber: report.callNumber,
      },
      null,
      2,
    ),
  );
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
