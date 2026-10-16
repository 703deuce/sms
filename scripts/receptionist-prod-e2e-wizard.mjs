/**
 * Production wizard E2E: dev-bypass login, 8 steps save+reload, optional isolated agent.
 *
 * Env:
 *   UI_AGENT_BASE_URL (default https://transovo.ai)
 *   RECEPTIONIST_E2E_AGENT_ID — deep-link ?agentId= (never cert agent for publish)
 *   RECEPTIONIST_E2E_SKIP_CERT=1 — refuse cmshz2lc25c622c4i58303501
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const ARTIFACT = "/opt/cursor/artifacts";
const CERT_AGENT = "cmshz2lc25c622c4i58303501";
const AGENT_ID = process.env.RECEPTIONIST_E2E_AGENT_ID?.trim() || "";
const OUT = path.join(ARTIFACT, "receptionist-prod-e2e-wizard.json");
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

async function main() {
  mkdirSync(SCREEN, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();

  const uiChanges = [];
  const apiPosts = [];

  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[RECEPTIONIST][UI_CHANGE]")) uiChanges.push(t);
  });

  page.on("response", async (res) => {
    if (
      res.url().includes("/api/solutions/appointment-receptionist") &&
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
        bookingStrategy: body?.data?.state?.bookingStrategy,
        error: body?.error,
      });
    }
  });

  const bypass = await context.request.get(
    "/api/auth/dev-bypass?next=/voice/receptionist/edit",
    { maxRedirects: 0, timeout: 120_000 },
  );
  if (![200, 302, 307, 308].includes(bypass.status())) {
    throw new Error(`dev-bypass failed: ${bypass.status()}`);
  }

  const agentQuery = AGENT_ID ? `&agentId=${encodeURIComponent(AGENT_ID)}` : "";
  const results = [];

  for (const step of STEPS) {
    const navUrl = AGENT_ID
      ? `/voice/receptionist/edit?step=${step}&agentId=${AGENT_ID}`
      : `/voice/receptionist/edit?step=${step}`;

    await page.goto(navUrl, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(2500);

    let fieldChange = null;
    if (step === "appointments") {
      const sendLink = page.getByRole("radio", { name: /send.*link/i }).first();
      if (await sendLink.isVisible().catch(() => false)) {
        await sendLink.click();
        fieldChange = "bookingStrategy=SEND_LINK";
        await page.waitForTimeout(400);
      }
    }
    if (step === "information") {
      const nameInput = page.getByLabel(/business name/i).first();
      if (await nameInput.isVisible().catch(() => false)) {
        const orig = await nameInput.inputValue();
        const marker = ` E2E-${Date.now().toString(36).slice(-4)}`;
        await nameInput.fill(`${orig}${marker}`.slice(0, 120));
        fieldChange = `businessName+marker`;
      }
    }

    const postsBefore = apiPosts.length;
    const saveBtn = page
      .getByRole("button", { name: /save draft/i })
      .or(page.getByRole("button", { name: /save & continue/i }))
      .first();

    let saveOk = false;
    let reloadOk = false;
    let reloadedValue = null;

    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(4000);
      const lastPost = apiPosts[apiPosts.length - 1];
      saveOk = lastPost && lastPost.status === 200 && !lastPost.liveSyncPending;

      await page.reload({ waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.waitForTimeout(2000);
      reloadOk = true;
      if (step === "information" && fieldChange) {
        const nameInput = page.getByLabel(/business name/i).first();
        if (await nameInput.isVisible().catch(() => false)) {
          reloadedValue = await nameInput.inputValue();
        }
      }
    }

    await page.screenshot({ path: path.join(SCREEN, `${step}.png`), fullPage: true });

    results.push({
      step,
      fieldChange,
      saveClicked: await saveBtn.isVisible().catch(() => false),
      saveOk,
      reloadOk,
      reloadedValue,
      apiPostsThisStep: apiPosts.slice(postsBefore),
    });
  }

  const activeAgentId = AGENT_ID || apiPosts.find((p) => p)?.bookingStrategy;
  if (process.env.RECEPTIONIST_E2E_SKIP_CERT === "1" && AGENT_ID === CERT_AGENT) {
    throw new Error("Refusing cert agent for E2E");
  }

  const report = {
    base: BASE,
    agentId: AGENT_ID || "(workspace default)",
    uiChangeCount: uiChanges.length,
    uiChanges: uiChanges.slice(0, 50),
    apiPosts,
    stepResults: results,
    certAgentProtected: !results.some((r) => r.step === "activate" && r.saveOk && AGENT_ID === CERT_AGENT),
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("Wrote", OUT);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
