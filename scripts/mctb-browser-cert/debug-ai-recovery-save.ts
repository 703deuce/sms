#!/usr/bin/env tsx
import { chromium } from "playwright";
import { authenticateMctbProd } from "./auth";
import { snapshotBackend } from "./snapshot";
import { gotoMctb } from "./ui-persistence-helpers";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID || "ws_1";
const EMAIL = process.env.MCTB_PROD_CERT_EMAIL || "";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await authenticateMctbProd(context, BASE, WORKSPACE_ID, EMAIL);
  const page = await context.newPage();
  const posts: unknown[] = [];
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      (req.url().includes("/api/mctb/ai-recovery/settings") ||
        req.url().includes("/api/mctb/lead-recovery/config"))
    ) {
      posts.push({ url: req.url(), body: req.postDataJSON() });
    }
  });

  await gotoMctb(page, BASE, "/mctb/ai-recovery");
  await page.waitForTimeout(2000);
  const capsBefore = snapshotBackend(WORKSPACE_ID).leadRecovery?.collectCapabilities;
  console.log("capsBefore", capsBefore);

  const toggle = page
    .getByRole("switch", { name: /collect best time to call back/i })
    .or(page.locator("#collect-CALLBACK_TIME"))
    .first();
  await toggle.waitFor({ state: "visible", timeout: 60_000 });
  const checked = await toggle.isChecked();
  console.log("toggleChecked", checked);
  if (!checked) await toggle.click();
  await page.waitForTimeout(300);
  const saveBtn = page.getByRole("button", { name: /save/i }).first();
  await saveBtn.click();
  await page.waitForTimeout(5000);
  const capsAfter = snapshotBackend(WORKSPACE_ID).leadRecovery?.collectCapabilities;
  console.log("capsAfter", capsAfter);
  console.log("posts", JSON.stringify(posts, null, 2));
  await browser.close();
}

main();
