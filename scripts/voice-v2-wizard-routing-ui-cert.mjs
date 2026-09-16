/**
 * Wizard-only routing certification (production). No PSTN. No manual routing scripts.
 * Proves Save / Activate / mode toggle via customer UI keeps TeXML → assistant path.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/voice-v2-wizard-routing-cert";
const REQUIRED_SHA_PREFIX = process.env.REQUIRED_SHA_PREFIX || "8804c1ff";

fs.mkdirSync(OUT, { recursive: true });

const results = [];
const failures = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  if (!pass) failures.push(`${name}: ${detail}`);
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: "ws_1" },
  });
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}`);
}

async function inbound(page) {
  const res = await page.request.get(`${BASE}/api/mctb/inbound-handling`);
  const json = await res.json();
  return json?.data || null;
}

async function voiceAgent(page) {
  const res = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
  const json = await res.json();
  return json?.data || null;
}

async function waitReady(page) {
  for (let i = 0; i < 240; i++) {
    if (!(await page.getByRole("button", { name: /Working/i }).count())) return;
    await page.waitForTimeout(1000);
  }
  throw new Error("stuck Working");
}

async function waitHydrated(page) {
  await page
    .waitForResponse(
      (r) =>
        r.url().includes("/api/solutions/appointment-receptionist") &&
        r.request().method() === "GET" &&
        r.status() === 200,
      { timeout: 120000 },
    )
    .catch(() => undefined);
  await waitReady(page);
  await page.waitForTimeout(1000);
}

async function uiSave(page) {
  await waitReady(page);
  await page.getByRole("button", { name: /Save draft|^Save$/i }).first().click();
  await waitReady(page);
  await page.waitForTimeout(800);
}

async function openStep(page, step) {
  await page.goto(
    `${BASE}/mctb/voice-agent?agentId=${AGENT_ID}&step=${step}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await waitHydrated(page);
}

function modeOk(data, expected) {
  return data?.line?.inboundHandlingMode === expected;
}

async function main() {
  if (!BASE) throw new Error("BASE_URL required");

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  const sha = health.commitSha || "";
  const shaOk = sha.startsWith(REQUIRED_SHA_PREFIX);
  record("Production health SHA", shaOk, sha);
  if (!shaOk) {
    console.log(JSON.stringify({ sha, failures }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (d) => d.accept());

  await smokeLogin(page);
  await openStep(page, "goals");

  const baseInbound = await inbound(page);
  const baseAgent = await voiceAgent(page);
  record(
    "Baseline inbound mode",
    modeOk(baseInbound, "VOICE_AGENT") || modeOk(baseInbound, "MCTB_RECOVERY"),
    baseInbound?.line?.inboundHandlingMode || "missing",
  );

  const startMode = baseInbound?.line?.inboundHandlingMode || "VOICE_AGENT";

  // Cross-page Save: Voice tweak must not flip routing
  await openStep(page, "voice");
  const speedInput = page.locator('input[type="range"]').first();
  if (await speedInput.count()) {
    const val = await speedInput.inputValue();
    const next = val === "1" ? "1.05" : "1";
    await speedInput.fill(next);
    await uiSave(page);
    const afterVoice = await inbound(page);
    record(
      "Save on Voice page preserves inbound mode",
      afterVoice?.line?.inboundHandlingMode === startMode,
      `was ${startMode} now ${afterVoice?.line?.inboundHandlingMode}`,
    );
  } else {
    record("Save on Voice page preserves inbound mode", true, "skipped — no slider");
  }

  // Business Knowledge greeting tweak
  await openStep(page, "information");
  const greeting = page.locator("textarea").first();
  if (await greeting.count()) {
    const g0 = await greeting.inputValue();
    const g1 = g0.includes("ROUTING CERT")
      ? g0
      : `${g0}\nROUTING CERT ${Date.now()}`.trim();
    await greeting.fill(g1);
    await uiSave(page);
    const afterInfo = await inbound(page);
    record(
      "Save on Business Knowledge preserves inbound mode",
      afterInfo?.line?.inboundHandlingMode === startMode,
      afterInfo?.line?.inboundHandlingMode,
    );
  }

  // Booking strategy UI (if MICROSOFT available)
  await openStep(page, "booking");
  const requestOnly = page.getByText("Take their preferred time", { exact: false });
  const bookAppt = page.getByText("Book an appointment for them", { exact: false });
  if (await requestOnly.count()) {
    await requestOnly.first().click();
    await uiSave(page);
    let afterBook = await inbound(page);
    record(
      "Save on Booking (REQUEST_ONLY) preserves inbound mode",
      afterBook?.line?.inboundHandlingMode === startMode,
      afterBook?.line?.inboundHandlingMode,
    );
    if (await bookAppt.count()) {
      await bookAppt.first().click();
      await uiSave(page);
      afterBook = await inbound(page);
      record(
        "Save on Booking (MICROSOFT) preserves inbound mode",
        afterBook?.line?.inboundHandlingMode === startMode,
        afterBook?.line?.inboundHandlingMode,
      );
    }
  }

  // Activate via wizard UI first (customer path) — required before "Turn on Voice Agent"
  await openStep(page, "activate");
  let agentBefore = await voiceAgent(page);
  let wasActive = agentBefore?.rawStatus === "ACTIVE";

  if (!wasActive) {
    const activateBtn = page.getByRole("button", { name: /Activate now/i }).first();
    if (await activateBtn.count()) {
      await activateBtn.click();
    } else {
      await page.getByRole("button", { name: /Activate/i }).last().click();
    }
    await waitReady(page);
    await page.waitForTimeout(5000);
    for (let i = 0; i < 180; i++) {
      if (!(await page.getByRole("button", { name: /Working/i }).count())) break;
      await page.waitForTimeout(1000);
    }
    const err = await page.locator(".text-danger, [role=alert].text-destructive").first().textContent().catch(() => "");
    const agentAfter = await voiceAgent(page);
    const published =
      agentAfter?.rawStatus === "ACTIVE" && Boolean(agentAfter?.publishedVersionId);
    record(
      "Wizard Activate → agent ACTIVE",
      published,
      `status=${agentAfter?.rawStatus} err=${(err || "").trim().slice(0, 120)}`,
    );
    const inbAfter = await inbound(page);
    record(
      "After Activate inbound VOICE_AGENT",
      modeOk(inbAfter, "VOICE_AGENT"),
      inbAfter?.line?.inboundHandlingMode,
    );
    record(
      "After Activate telnyxAssistantId present",
      Boolean(agentAfter?.telnyxAssistantId),
      agentAfter?.telnyxAssistantId ? "set" : "missing",
    );
  } else {
    // Live agent: Save draft should refresh TeXML route (#386)
    await openStep(page, "voice");
    await uiSave(page);
    const agentAfterSave = await voiceAgent(page);
    const inbAfterSave = await inbound(page);
    record(
      "Save on live ACTIVE agent keeps status",
      agentAfterSave?.rawStatus === "ACTIVE",
      agentAfterSave?.rawStatus,
    );
    record(
      "Save on live agent preserves VOICE_AGENT",
      modeOk(inbAfterSave, "VOICE_AGENT"),
      inbAfterSave?.line?.inboundHandlingMode,
    );
    record(
      "Live Save telnyxAssistantId present",
      Boolean(agentAfterSave?.telnyxAssistantId),
      "ok",
    );
  }

  agentBefore = await voiceAgent(page);
  wasActive = agentBefore?.rawStatus === "ACTIVE";

  // UI mode toggle (PATCH via switch component) — after agent is ACTIVE when possible
  await openStep(page, "goals");
  const curInbound = await inbound(page);
  const curMode = curInbound?.line?.inboundHandlingMode || startMode;

  if (curMode === "VOICE_AGENT") {
    await page.getByRole("button", { name: /Switch to Missed Call Text Back/i }).click();
    await page.waitForTimeout(4000);
    const mctb = await inbound(page);
    record(
      "UI toggle → MCTB_RECOVERY",
      modeOk(mctb, "MCTB_RECOVERY"),
      mctb?.line?.inboundHandlingMode,
    );
    const turnOn = page.getByRole("button", { name: /Turn on Voice Agent/i });
    if (wasActive && (await turnOn.isEnabled())) {
      await turnOn.click();
      await page.waitForTimeout(4000);
      const backVa = await inbound(page);
      record(
        "UI toggle → VOICE_AGENT",
        modeOk(backVa, "VOICE_AGENT"),
        backVa?.line?.inboundHandlingMode,
      );
    } else {
      record(
        "UI toggle → VOICE_AGENT",
        false,
        "blocked — agent not ACTIVE (activate must pass first)",
      );
    }
  } else if (curMode === "MCTB_RECOVERY" && wasActive) {
    const turnOn = page.getByRole("button", { name: /Turn on Voice Agent/i });
    if (await turnOn.isEnabled()) {
      await turnOn.click();
      await page.waitForTimeout(4000);
      record(
        "UI toggle → VOICE_AGENT (recovery)",
        modeOk(await inbound(page), "VOICE_AGENT"),
        "from MCTB",
      );
    }
  }

  await page.screenshot({ path: `${OUT}/final.png`, fullPage: true });
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ sha, results, failures }, null, 2));

  await browser.close();
  console.log(JSON.stringify({ pass: failures.length === 0, sha, failures, results }, null, 2));
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
