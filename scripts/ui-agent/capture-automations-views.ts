import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { generatedDirForSession } from "./generated-sandbox";
import { log } from "./logger";

const SESSION = "2026-08-30T21-35-06-283Z-baf6cd";
const OUT_DIR = "/opt/cursor/artifacts/kimi_automations";

async function captureAll(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const { startPreviewServer } = await import("./preview");
  const { url, close } = await startPreviewServer(SESSION);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);

    const shots: Array<{ file: string; label: string }> = [
      { file: "01_list.png", label: "Workflow list" },
    ];

    await page.screenshot({ path: join(OUT_DIR, "01_list.png"), fullPage: true });
    log("captured", "01_list.png");

    const createBtn = page.getByRole("button", { name: /create workflow/i });
    if (await createBtn.count()) {
      await createBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(OUT_DIR, "02_builder_setup.png"), fullPage: true });
      shots.push({ file: "02_builder_setup.png", label: "Builder — setup panel" });
      log("captured", "02_builder_setup.png");

      const buildSection = page.getByRole("button", { name: /^2\s*Build/i });
      if (await buildSection.count()) {
        await buildSection.first().click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({ path: join(OUT_DIR, "03_builder_palette.png"), fullPage: true });
      shots.push({ file: "03_builder_palette.png", label: "Builder — palette tabs" });
      log("captured", "03_builder_palette.png");

      const paletteItem = page.locator(".palette-item").first();
      if (await paletteItem.count()) {
        const canvas = page.locator(".wf-canvas-bg").first();
        const canvasBox = await canvas.boundingBox();
        const itemBox = await paletteItem.boundingBox();
        if (canvasBox && itemBox) {
          await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + 180, { steps: 12 });
          await page.mouse.up();
          await page.waitForTimeout(600);
        }
      }

      await page.screenshot({ path: join(OUT_DIR, "04_builder_with_node.png"), fullPage: true });
      shots.push({ file: "04_builder_with_node.png", label: "Builder with node on canvas" });
      log("captured", "04_builder_with_node.png");

      const node = page.locator(".wf-node").first();
      if (await node.count()) {
        await node.locator('[data-no-drag]').first().click({ force: true });
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(OUT_DIR, "05_builder_config_modal.png"), fullPage: true });
        shots.push({ file: "05_builder_config_modal.png", label: "Builder + config modal" });
        log("captured", "05_builder_config_modal.png");
      }
    }

    copyFileSync(join(OUT_DIR, "01_list.png"), "/opt/cursor/artifacts/kimi_done_automations.png");

    console.log("\nAutomations screenshots:");
    for (const s of shots) {
      console.log(`  ${s.label}: ${join(OUT_DIR, s.file)}`);
    }
  } finally {
    await browser.close();
    await close();
  }
}

captureAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
