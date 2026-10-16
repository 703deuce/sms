/**
 * Fill activation blockers on isolated DRAFT agent, then click Activate.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://transovo.ai";
const AGENT = process.env.RECEPTIONIST_E2E_AGENT_ID || "cmu42zyel1c4x01090c6s335z";
const OUT = "/opt/cursor/artifacts/receptionist-prod-activate-attempt.json";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  await ctx.request.get("/api/auth/dev-bypass?next=/voice/receptionist/edit", { maxRedirects: 0 });
  await ctx.request.post("/api/workspace", { data: { workspaceId: "ws_1" } });
  const page = await ctx.newPage();
  const apiPosts = [];
  page.on("response", async (res) => {
    if (!res.url().includes("appointment-receptionist") || res.request().method() !== "POST") return;
    apiPosts.push({ status: res.status(), body: await res.json().catch(() => null) });
  });

  await page.goto(`/voice/receptionist/edit?step=information&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(3000);
  const biz = page.getByLabel(/business name/i).first();
  if (await biz.isVisible().catch(() => false)) {
    await biz.fill("Summit Electric E2E Test");
  }
  const web = page.getByLabel(/website/i).first();
  if (await web.isVisible().catch(() => false)) {
    await web.fill("https://example.com");
  }
  await page.getByRole("button", { name: /save draft/i }).first().click();
  await page.waitForTimeout(6000);

  await page.goto(`/voice/receptionist/edit?step=phone&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(3000);
  const phoneRadio = page.getByRole("radio").filter({ hasText: /\+1|57|3615|8077|6264/ }).first();
  if (await phoneRadio.isVisible().catch(() => false)) {
    await phoneRadio.click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /save draft/i }).first().click();
  await page.waitForTimeout(6000);

  await page.goto(`/voice/receptionist/edit?step=activate&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(4000);
  const btn = page.getByTestId("wizard-activate-submit");
  const disabled = await btn.isDisabled();
  let activatePost = null;
  if (!disabled) {
    await btn.click();
    await page.waitForTimeout(25_000);
    activatePost = apiPosts.find((p) => p.body?.data?.action === "activate") || apiPosts.at(-1);
  }
  await page.screenshot({ path: "/opt/cursor/artifacts/receptionist-activate-after-fix.png", fullPage: true });

  writeFileSync(
    OUT,
    JSON.stringify({ agent: AGENT, disabled, apiPosts, activatePost }, null, 2),
  );
  console.log("wrote", OUT, "disabled", disabled, "posts", apiPosts.length);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
