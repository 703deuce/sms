/**
 * Visual QA + interaction crawl for the Appointment Receptionist wizard.
 * Writes screenshots to /opt/cursor/artifacts/wizard-qa/
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/wizard-qa";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const report = { steps: [], errors: [], clicks: [], agentId: null };

  page.on("pageerror", (err) => report.errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.errors.push(`console: ${msg.text()}`);
  });

  // Mock phone numbers + wizard persist APIs so preview works without DB.
  await page.route("**/api/phone/numbers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "pn_demo_1",
            e164: "+15715550123",
            friendlyName: "Main Office",
            status: "active",
          },
        ],
      }),
    });
  });

  let persistCount = 0;
  await page.route("**/api/solutions/appointment-receptionist", async (route) => {
    persistCount += 1;
    const body = route.request().postDataJSON() || {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          agentId: "agent_demo_wizard_1",
          name: body.state?.solutionName || "Main Office Appointment Receptionist",
          status: body.action === "activate" ? "ACTIVE" : "DRAFT",
          published: body.action === "activate",
          publishError: null,
        },
      }),
    });
  });

  await page.route("**/api/voice/tts-preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { audioUrl: null } }),
    });
  });

  // Clear prior draft
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("transovo.appointment-receptionist.wizard.v1");
    } catch {}
  });

  await page.goto(`${BASE}/dev/appointment-wizard`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("text=What should your receptionist do?", { timeout: 30000 });

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    report.steps.push({ name, file });
    console.log("shot", name);
  };

  await shot("01-goals");

  // Toggle a capability card
  await page.getByRole("button", { name: /Take messages/i }).click();
  report.clicks.push("toggle Take messages");

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=Where should the receptionist answer?", { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot("02-phone");

  // Select number + greeting
  await page.getByText("(571) 555-0123").first().click().catch(() => undefined);
  await page.getByRole("button", { name: /Transovo professional greeting/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=What should your receptionist know?", { timeout: 15000 });
  await shot("03-information");

  await page.getByPlaceholder("https://www.example.com").fill("https://www.johnsonplumbing.com");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("03b-information-scanned");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=What can callers book?", { timeout: 15000 });
  await shot("04-appointments");

  await page.getByRole("button", { name: /Google Calendar/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=How should your receptionist handle calls?", { timeout: 15000 });
  await shot("05-call-handling");

  await page.getByPlaceholder("Name").fill("Anthony Johnson");
  await page.getByPlaceholder("+1 (555) 000-0000").fill("+15555550199");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=Who is your receptionist?", { timeout: 15000 });
  await shot("06-voice");

  await page.getByRole("button", { name: /Allie/i }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=Test your receptionist", { timeout: 15000 });
  await shot("07-test");

  await page.getByRole("button", { name: /Run test scenario/i }).click();
  await page.waitForTimeout(3500);
  await shot("07b-test-running");
  const passed = await page.getByText("Passed").count();
  report.clicks.push(`test passed badge count=${passed}`);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForSelector("text=Make your receptionist live", { timeout: 15000 });
  await shot("08-activate");

  // Save draft button
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.waitForTimeout(500);
  report.clicks.push(`persistCount after save draft=${persistCount}`);

  // Activate
  await page.getByRole("button", { name: "Activate now" }).last().click();
  await page.waitForTimeout(800);
  report.clicks.push(`persistCount after activate=${persistCount}`);
  report.agentId = "agent_demo_wizard_1";

  // Back navigation smoke from earlier: reload mid-wizard draft
  await page.goto(`${BASE}/dev/appointment-wizard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("09-restored-draft");

  // Solution landing (may redirect to login without auth — capture either way)
  await page.goto(`${BASE}/solutions/ai-call-handling/appointment-assistant`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(1000);
  await shot("00-solution-landing-or-login");

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
