/**
 * Production AI Receptionist wizard E2E (transovo.ai).
 * - dev-bypass login
 * - switch to WORKSPACE_ID (default ws_1)
 * - 8 steps: change field, save draft, reload, verify API
 * - optional publish on isolated DRAFT agent (never cert agent)
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const ARTIFACT = "/opt/cursor/artifacts";
const CERT_AGENT = "cmshz2lc25c622c4i58303501";
const AGENT_ID = process.env.RECEPTIONIST_E2E_AGENT_ID?.trim() || "";
const ALLOW_PUBLISH = process.env.RECEPTIONIST_E2E_ALLOW_PUBLISH === "1";
const OUT = path.join(ARTIFACT, "receptionist-prod-full-e2e.json");
const SCREEN = path.join(ARTIFACT, "receptionist-prod-e2e-screens");

const STEPS = [
  "goals",
  "phone",
  "information",
  "appointments",
  "call-handling",
  "voice",
  "test",
  "activate",
];

async function devBypass(context) {
  const res = await context.request.get(
    "/api/auth/dev-bypass?next=/voice/receptionist/edit",
    { maxRedirects: 0, timeout: 120_000 },
  );
  if (![200, 302, 307, 308].includes(res.status())) {
    throw new Error(`dev-bypass failed: ${res.status()}`);
  }
}

async function switchWorkspace(context) {
  const ws = await context.request.post("/api/workspace", {
    data: { workspaceId: WORKSPACE_ID },
    timeout: 60_000,
  });
  const body = await ws.json().catch(() => ({}));
  if (!ws.ok()) {
    throw new Error(`workspace switch failed: ${ws.status()} ${JSON.stringify(body)}`);
  }
  const who = await context.request.get("/api/workspace", { timeout: 60_000 });
  const whoJson = await who.json();
  return whoJson?.data?.workspaceId || body.workspaceId;
}

async function main() {
  mkdirSync(SCREEN, { recursive: true });
  if (AGENT_ID === CERT_AGENT && ALLOW_PUBLISH) {
    throw new Error("Refusing publish on certification agent");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const uiChanges = [];
  const consoleLines = [];
  const apiPosts = [];

  page.on("console", (msg) => {
    const t = msg.text();
    consoleLines.push(t);
    if (t.includes("[RECEPTIONIST]")) uiChanges.push(t);
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (
      url.includes("/api/solutions/appointment-receptionist") &&
      res.request().method() === "POST"
    ) {
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      apiPosts.push({
        status: res.status(),
        receptionistTraceId: body?.data?.receptionistTraceId,
        published: body?.data?.published,
        liveSyncPending: body?.data?.liveSyncPending,
        configRevision: body?.data?.configRevision,
        action: body?.data?.action || res.request().postDataJSON?.()?.action,
        bookingStrategy: body?.data?.state?.bookingStrategy,
        error: body?.error,
      });
    }
  });

  await devBypass(context);
  const activeWs = await switchWorkspace(context);

  const agentQuery = AGENT_ID ? `&agentId=${encodeURIComponent(AGENT_ID)}` : "";
  const results = [];
  let publishedRevisionBefore = null;

  if (AGENT_ID) {
    const agentGet = await context.request.get(`/api/voice/agents/${AGENT_ID}`);
    const agentJson = await agentGet.json().catch(() => ({}));
    publishedRevisionBefore =
      agentJson?.data?.publishedConfigRevision ??
      agentJson?.data?.configRevision ??
      null;
  }

  for (const step of STEPS) {
    const navUrl = `/voice/receptionist/edit?step=${step}${agentQuery ? agentQuery.replace("&", "&") : ""}`;
    await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(3000);

    let fieldChange = null;
    if (step === "appointments") {
      const sendLink = page.getByRole("radio", { name: /send.*link/i }).first();
      if (await sendLink.isVisible().catch(() => false)) {
        await sendLink.click();
        fieldChange = "bookingStrategy=SEND_LINK";
        await page.waitForTimeout(500);
      }
    }
    if (step === "information") {
      const nameInput = page.getByLabel(/business name/i).first();
      if (await nameInput.isVisible().catch(() => false)) {
        const orig = await nameInput.inputValue();
        const marker = ` E2E${Date.now().toString(36).slice(-5)}`;
        await nameInput.fill(`${orig.replace(/\s+E2E[a-z0-9]+$/i, "")}${marker}`.slice(0, 120));
        fieldChange = `businessName${marker}`;
        await page.waitForTimeout(300);
      }
    }
    if (step === "goals") {
      const cb = page.getByRole("checkbox", { name: /answer questions/i }).first();
      if (await cb.isVisible().catch(() => false)) {
        const checked = await cb.isChecked();
        if (!checked) await cb.check();
        fieldChange = "answerQuestions=on";
      }
    }

    const postsBefore = apiPosts.length;
    const saveBtn = page
      .getByRole("button", { name: /save draft/i })
      .or(page.getByRole("button", { name: /save & continue/i }))
      .first();

    let saveOk = false;
    let reloadOk = false;

    if (step !== "activate" && (await saveBtn.isVisible().catch(() => false))) {
      await saveBtn.click();
      await page.waitForTimeout(5000);
      const lastPost = apiPosts[apiPosts.length - 1];
      saveOk = Boolean(lastPost && lastPost.status === 200 && !lastPost.liveSyncPending);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.waitForTimeout(2000);
      reloadOk = true;
    }

    let publishAttempt = null;
    if (step === "activate" && ALLOW_PUBLISH && AGENT_ID && AGENT_ID !== CERT_AGENT) {
      const pubBtn = page
        .getByTestId("wizard-activate-submit")
        .or(page.getByRole("button", { name: /^activate$/i }))
        .first();
      if (await pubBtn.isVisible().catch(() => false)) {
        await pubBtn.click();
        await page.waitForTimeout(12_000);
        const lastPost = apiPosts[apiPosts.length - 1];
        publishAttempt = {
          clicked: true,
          lastApi: lastPost,
        };
      } else {
        publishAttempt = { clicked: false, reason: "no publish button visible" };
      }
    }

    await page.screenshot({ path: path.join(SCREEN, `full-${step}.png`), fullPage: true });

    results.push({
      step,
      fieldChange,
      saveOk,
      reloadOk,
      publishAttempt,
      apiPostsThisStep: apiPosts.slice(postsBefore),
      uiChangesThisStep: uiChanges.length,
    });
  }

  let publishedRevisionAfter = publishedRevisionBefore;
  if (AGENT_ID) {
    const agentGet2 = await context.request.get(`/api/voice/agents/${AGENT_ID}`);
    const agentJson2 = await agentGet2.json().catch(() => ({}));
    publishedRevisionAfter =
      agentJson2?.data?.publishedConfigRevision ??
      agentJson2?.data?.configRevision ??
      null;
  }

  const report = {
    base: BASE,
    workspaceId: activeWs,
    agentId: AGENT_ID || "(default workspace agent)",
    allowPublish: ALLOW_PUBLISH,
    publishedRevisionBefore,
    publishedRevisionAfter,
    uiChangeCount: uiChanges.length,
    uiChangesSample: uiChanges.slice(0, 80),
    apiPosts,
    stepResults: results,
    consoleReceptionistLines: consoleLines.filter((l) => l.includes("[RECEPTIONIST]")).slice(0, 100),
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("Wrote", OUT);
  console.log(
    JSON.stringify({
      workspace: activeWs,
      saves200: apiPosts.filter((p) => p.status === 200).length,
      uiChanges: uiChanges.length,
      traceIds: [...new Set(apiPosts.map((p) => p.receptionistTraceId).filter(Boolean))],
    }),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
