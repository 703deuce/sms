/**
 * Customer-style E2E: Personal vault → voicemail → forwarding (browser UI).
 * Run: npx tsx scripts/test-personal-customer-e2e.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (
  process.env.BASE_URL ||
  process.env.APP_URL ||
  process.env.LOCAL_APP_URL ||
  ""
).replace(/\/$/, "");
if (!BASE) {
  console.error("Set BASE_URL or APP_URL");
  process.exit(1);
}
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim();
const PASSWORD = (process.env.OWNER_PASSWORD || "demo1234");
const FORWARD_TO = (process.env.PERSONAL_FORWARD_TO || "+15714776175").trim();
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR || "/opt/cursor/artifacts/screenshots/personal-e2e";

const steps = [];

function log(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1) Login via login form (customer path)
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    (url) => !url.pathname.includes("/login"),
    { timeout: 30000 },
  );
  log("ui-login", true, `landed ${page.url()}`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "01-after-login.png") });

  // 2) Ensure Personal workspace
  const wsBtn = page.getByRole("button", { name: /workspace|personal|blue ridge/i }).first();
  if (await wsBtn.isVisible().catch(() => false)) {
    await wsBtn.click();
    const personalOpt = page.getByText("Personal", { exact: true }).first();
    if (await personalOpt.isVisible().catch(() => false)) {
      await personalOpt.click();
      await page.waitForTimeout(1500);
    }
  }
  await page.goto(`${BASE}/personal`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  log("personal-overview", page.url().includes("/personal"), page.url());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "02-personal-overview.png") });

  // 3) Number Vault — parked number visible
  await page.goto(`${BASE}/personal/vault`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const vaultHtml = await page.content();
  const has866 = vaultHtml.includes("866") || vaultHtml.includes("63464256");
  log("vault-page", has866, has866 ? "number visible in vault" : "parked number not found in HTML");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "03-vault.png") });

  // 4) Reactivate from vault (required before voicemail / forwarding)
  const reactivateBtn = page.getByRole("button", { name: /Reactivate Number/i }).first();
  if (await reactivateBtn.isVisible().catch(() => false)) {
    await reactivateBtn.click();
    await page.waitForTimeout(2000);
    log("vault-reactivate", true, "clicked reactivate");
  } else {
    log("vault-reactivate", false, "reactivate button not found");
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "04-after-reactivate.png") });

  // Resolve number id from API (session cookies from browser)
  const cookies = (await context.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const numsRes = await page.request.get(`${BASE}/api/numbers`, { headers: { cookie: cookies } });
  const numsJson = await numsRes.json().catch(() => ({}));
  const numberRow = (numsJson.data || [])[0];
  const numberId = numberRow?.id;
  log("resolve-number", Boolean(numberId), numberId || "no number");
  if (!numberId) {
    await browser.close();
    printSummary();
    process.exit(1);
  }

  // 5) Voicemail — enable and save settings
  await page.goto(
    `${BASE}/personal/voicemail?numberId=${numberId}`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await page.waitForTimeout(2000);
  const saveSettings = page.getByRole("button", { name: "Save Settings" });
  await saveSettings.waitFor({ state: "visible", timeout: 15000 });
  await saveSettings.click();
  await page.waitForTimeout(2500);
  const settingsMsg = await page.getByText("Settings saved.").isVisible().catch(() => false);
  log("voicemail-save", settingsMsg, settingsMsg ? "Settings saved" : "no success message");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "05-voicemail.png") });

  // Verify voicemail enabled via API
  const numCheck = await page.request.get(`${BASE}/api/numbers/${numberId}`, {
    headers: { cookie: cookies },
  });
  const numJson = await numCheck.json().catch(() => ({}));
  const vmEnabled =
    numJson.data?.settingsJson?.voicemailEnabled === true ||
    numJson.data?.voicemailEnabled === true;
  log("voicemail-api", vmEnabled, JSON.stringify(numJson.data?.settingsJson?.personalServiceState));

  // 6) Forwarding — save destination
  await page.goto(
    `${BASE}/personal/forwarding?numberId=${numberId}`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await page.waitForTimeout(2000);
  const editBtn = page.getByRole("button", { name: "Edit" }).first();
  if (await editBtn.isVisible().catch(() => false)) {
    await editBtn.click();
  }
  const destInput = page.getByPlaceholder("Forward to number");
  await destInput.waitFor({ state: "visible", timeout: 15000 });
  await destInput.fill(FORWARD_TO);
  const saveFwd = page.getByRole("button", { name: "Save Changes" });
  await saveFwd.click();
  await page.waitForTimeout(2500);
  const fwdSaved = await page
    .getByText(/saved|updated|forwarding/i)
    .first()
    .isVisible()
    .catch(() => false);
  log("forwarding-save-ui", fwdSaved, fwdSaved ? "save feedback visible" : "no save feedback");

  const numAfter = await page.request.get(`${BASE}/api/numbers/${numberId}`, {
    headers: { cookie: cookies },
  });
  const afterJson = await numAfter.json().catch(() => ({}));
  const forwardSet = (afterJson.data?.voiceForwardTo || "").includes("5714776175");
  log(
    "forwarding-api",
    forwardSet,
    afterJson.data?.voiceForwardTo || "no voiceForwardTo",
  );
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "06-forwarding.png") });

  await browser.close();
  printSummary();
  const failed = steps.some((s) => !s.ok);
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log("\n--- Personal customer E2E summary ---");
  for (const s of steps) {
    console.log(`${s.ok ? "✓" : "✗"} ${s.name}: ${s.detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
