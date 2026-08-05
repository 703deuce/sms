/**
 * Browser UX verification for live Danny agent (no create — view experience).
 *   BASE_URL=https://transovo.ai node scripts/danny-browser-verify.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/danny-agent";
const AGENT_ID = process.env.AGENT_ID || "cmsga1kk03w0k4v48525s006k";
const FLOW_ID = process.env.FLOW_ID || "cmsga1poq2c06100o71253x22";
const DID = "+18663464256";

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  agentId: AGENT_ID,
  flowId: FLOW_ID,
  startedAt: new Date().toISOString(),
  ok: false,
  steps: [],
  errors: [],
};

function log(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`→ ${step}`, detail.message || detail.url || "");
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

    // My Agents list — find Danny
    await page.goto(`${BASE}/voice/agents`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await shot(page, "verify-01-agents-list");
    const listText = await page.locator("body").innerText();
    report.agentsList = {
      showsDanny: /Danny/i.test(listText),
      showsActive: /Active|Live/i.test(listText),
    };
    if (!report.agentsList.showsDanny) report.errors.push("Danny not visible on My Agents");
    log("agents-list", report.agentsList);

    // Agent detail page
    await page.goto(`${BASE}/voice/agents/${AGENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(2000);
    await shot(page, "verify-02-agent-page");
    const agentText = await page.locator("body").innerText();
    report.agentPage = {
      nameDanny: /Danny/i.test(agentText),
      lakeside: /Lakeside/i.test(agentText),
      allieOrUltra: /Allie|Ultra|allie-ultra/i.test(agentText),
      active: /Active|Live|Published/i.test(agentText),
      did: agentText.includes("866") || agentText.includes(DID),
    };
    log("agent-page", report.agentPage);
    if (!report.agentPage.nameDanny) report.errors.push("Agent page missing Danny");
    if (!report.agentPage.active) report.errors.push("Agent page does not show Active/Live");

    // Click into automations / open flow if link present
    const flowLink = page.getByRole("link", { name: /workflow|automation|flow|edit/i }).first();
    if (await flowLink.isVisible().catch(() => false)) {
      await flowLink.click();
      await page.waitForTimeout(2000);
      log("flow-link-clicked", { url: page.url() });
    }

    await page.goto(`${BASE}/automations/${FLOW_ID}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(3000);
    await shot(page, "verify-03-flow-builder");
    const flowText = await page.locator("body").innerText();
    report.builder = {
      hasInbound: /Inbound Call/i.test(flowText),
      hasRunVoice: /Run Voice Agent/i.test(flowText),
      hasOutcome: /Call Outcome/i.test(flowText),
      hasDiag: /Deployment diagnostics|flowGeneration|Telnyx/i.test(flowText),
      hasDid: flowText.includes("866") || flowText.includes(DID),
      liveHint: /live|ok|texml/i.test(flowText),
    };
    log("flow-builder", report.builder);
    if (!report.builder.hasInbound || !report.builder.hasRunVoice) {
      report.errors.push("Flow builder missing core nodes");
    }

    // Diagnostics API (proof) + surface in UI if panel open
    const diag = await page.request.get(
      `${BASE}/api/automations/${FLOW_ID}/diagnostics`,
    );
    const dj = await diag.json().catch(() => ({}));
    report.diagnostics = dj?.data
      ? {
          layers: dj.data.layers,
          deploymentStatus: dj.data.deploymentStatus,
          phoneE164: dj.data.phoneE164,
          telnyxAssistantId: dj.data.telnyxAssistantId,
          publishedRoutingTarget: dj.data.publishedRoutingTarget,
        }
      : null;
    log("diagnostics", report.diagnostics || {});

    if (report.diagnostics?.deploymentStatus !== "live") {
      report.errors.push("Diagnostics not live");
    }
    if (report.diagnostics?.layers?.assistantLaunch !== "ok") {
      report.errors.push("Assistant not ok");
    }
    if (report.diagnostics?.publishedRoutingTarget !== "texml_assistant") {
      report.errors.push("Routing target not texml_assistant");
    }

    report.callNumber = DID;
    report.testQuestions = [
      "What are your hours on Friday?",
      "Do you open on Saturday?",
      "How much is a new patient exam with cleaning and X-rays?",
      "Do you take Medicaid?",
      "Who is the lead dentist?",
      "Do you offer Invisalign?",
      "What is your late cancellation fee?",
      "Is parking free?",
      "What is the Wi-Fi password?",
      "Can I book a cleaning next Tuesday morning?",
    ];

    report.ok = report.errors.length === 0;
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.ok = false;
    await shot(page, "verify-fatal").catch(() => null);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(`${OUT}/browser-verify.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: report.ok,
        errors: report.errors,
        callNumber: report.callNumber,
        agentPage: report.agentPage,
        builder: report.builder,
        layers: report.diagnostics?.layers,
        assistant: report.diagnostics?.telnyxAssistantId,
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
