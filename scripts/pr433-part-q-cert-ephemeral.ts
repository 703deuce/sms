/**
 * Ephemeral PART Q certification runner — NOT committed to repo.
 * Proves Step 7 transport + captures evidence; conversation items need live mic/hearing.
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { createDefaultWizardState } from "/workspace/src/lib/solutions/appointment-receptionist/defaults";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "/workspace/src/lib/voice-receptionist-wizard/operating-maturity/defaults";
import { compileVoiceV3AgentConfig } from "/workspace/src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "/workspace/src/lib/voice-v3/config/booking-agent-config";
import { getPrisma } from "/workspace/src/lib/db";
import { resolveMicrosoftConnectionForWizard } from "/workspace/src/lib/voice-v3/config/resolve-microsoft-connection";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/pr433-part-q";
const STORAGE_KEY = "transovo.appointment-receptionist.wizard.v1";
const SETUP_PATH = "/dev/appointment-wizard";

const report: Record<string, string> = {};
const errors: string[] = [];
const networkLog: string[] = [];

function log(msg: string) {
  console.log(msg);
  appendFileSync(join(OUT, "cert.log"), msg + "\n");
}

mkdirSync(OUT, { recursive: true });

function buildJessicaDraft() {
  const base = createDefaultWizardState();
  const greeting =
    "Thanks for calling Johnson Home Remodeling. This is Jessica. How can I help you today?";
  const om = {
    ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG,
    revision: "cert-draft-v1",
    businessSchedule: {
      ...DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule,
      timezone: "America/Chicago",
      weekly: {
        monday: { closed: true, ranges: [] },
        tuesday: { closed: false, ranges: [{ start: "10:00", end: "16:00" }] },
        wednesday: { closed: false, ranges: [{ start: "10:00", end: "16:00" }] },
        thursday: { closed: false, ranges: [{ start: "10:00", end: "16:00" }] },
        friday: { closed: true, ranges: [] },
        saturday: { closed: true, ranges: [] },
        sunday: { closed: true, ranges: [] },
      },
    },
  };

  const { preset: _dropPreset, ...withoutPreset } = base as typeof base & { preset?: string };
  return {
    ...withoutPreset,
    agentName: "Jessica",
    businessName: "Johnson Home Remodeling",
    openingGreeting: greeting,
    solutionName: "PR433 PART Q Cert Agent",
    capabilities: base.capabilities.filter((c) => c !== "cancel"),
    voiceId: "ash",
    voiceLabel: "Ash",
    timezone: "America/Chicago",
    operatingMaturity: om,
    appointmentTypes: [
      {
        id: "consultation",
        name: "Consultation",
        durationMin: 30,
        calendar: "Main Calendar",
        status: "ready" as const,
        requiredFields: ["full_name", "phone"],
        bookingPermission: "book_directly" as const,
        enabled: true,
      },
      {
        id: "estimate",
        name: "Estimate",
        durationMin: 60,
        calendar: "Main Calendar",
        status: "ready" as const,
        requiredFields: ["full_name", "phone"],
        bookingPermission: "book_directly" as const,
        enabled: true,
      },
    ],
    selectedAppointmentTypeId: "consultation",
    collectFields: [
      { id: "full_name", label: "Name", required: true, enabled: true },
      { id: "phone", label: "Phone", required: true, enabled: true },
      { id: "email", label: "Email", required: false, enabled: true },
      {
        id: "project_type",
        label: "Project Type",
        required: true,
        enabled: true,
      },
      { id: "zip_code", label: "ZIP Code", required: false, enabled: true },
    ],
    bookingStrategy: "MICROSOFT_365" as const,
    calendarProvider: "microsoft",
    calendarConnected: true,
  };
}

function buildAmyPublished(draft: ReturnType<typeof buildJessicaDraft>) {
  return {
    ...draft,
    agentName: "Amy",
    businessName: "Legacy Published Office",
    openingGreeting: "Thanks for calling Legacy Published Office. This is Amy.",
    voiceId: "marin",
    voiceLabel: "Marin",
    appointmentTypes: [
      {
        id: "legacy_only",
        name: "Legacy Visit",
        durationMin: 60,
        calendar: "Main Calendar",
        status: "ready" as const,
        requiredFields: ["full_name", "phone"],
        bookingPermission: "book_directly" as const,
        enabled: true,
      },
    ],
    selectedAppointmentTypeId: "legacy_only",
    collectFields: [{ id: "full_name", label: "Name", required: true, enabled: true }],
    capabilities: [...draft.capabilities, "cancel"],
  };
}

async function main() {
  const jessica = buildJessicaDraft();
  const amy = buildAmyPublished(jessica);

  const prisma = getPrisma();
  const calendars = await prisma.voiceCalendarConnection.findMany({
    where: { provider: "microsoft", status: { in: ["connected", "active", "ok"] } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  const msConn = resolveMicrosoftConnectionForWizard(calendars, jessica.calendarEmail);
  const compiled = compileVoiceV3AgentConfig({
    wizard: jessica,
    source: "wizard_draft_test",
    envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
    providerConnections: msConn
      ? {
          microsoftConnectionId: msConn.id,
          microsoftCalendarIds: ["primary"],
        }
      : {},
  });

  const preSession = {
    source: compiled.source,
    configVersion: compiled.configVersion,
    agentName: compiled.identity?.agentName,
    liveVoiceId: compiled.telephony?.liveVoiceId,
    serviceIds: compiled.services?.map((s) => ({ id: s.id, duration: s.durationMinutes })),
    intakeFieldKeys: compiled.intakeFields.map((f) => f.key),
    requiredIntake: compiled.intakeFields.filter((f) => f.required).map((f) => f.key),
    capabilities: compiled.capabilities,
    microsoftConnectionId: compiled.calendar?.connectionId ?? null,
  };
  writeFileSync(join(OUT, "pre-session-compiled.json"), JSON.stringify(preSession, null, 2));
  log("PRE_SESSION_COMPILED " + JSON.stringify(preSession));

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext({
    permissions: ["microphone"],
  });
  const page = await context.newPage();

  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("v3-wizard-live-test") || u.includes("test-session") || u.includes("telnyx")) {
      networkLog.push(`REQ ${req.method()} ${u}`);
    }
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("v3-wizard-live-test")) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        body = "<unreadable>";
      }
      networkLog.push(`RES ${res.status()} ${u} ${body.slice(0, 500)}`);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  // Create + publish Amy, then save Jessica draft via API
  async function apiPost(payload: unknown) {
    return page.evaluate(async (body) => {
      const res = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text.slice(0, 200) };
      }
      return { ok: res.ok, status: res.status, json };
    }, payload);
  }

  const createOut = await apiPost({ action: "create_draft", state: amy });
  if (!createOut.ok) throw new Error(`create_draft failed: ${JSON.stringify(createOut)}`);
  const agentId = (createOut.json as { data?: { agentId?: string } }).data?.agentId as string;
  log("AGENT_ID " + agentId);

  const activateOut = await apiPost({
    action: "activate",
    state: { ...amy, agentId, activationMode: "activate_now" },
  });
  if (!activateOut.ok) log("ACTIVATE_WARN " + JSON.stringify(activateOut));
  else log("ACTIVATED published Amy");

  const draftOut = await apiPost({
    action: "save_draft",
    state: { ...jessica, agentId },
    wizardStepId: "test",
  });
  if (!draftOut.ok) throw new Error(`save_draft Jessica failed: ${JSON.stringify(draftOut)}`);
  log("DRAFT_SAVED Jessica");

  await page.goto(
    `${BASE}${SETUP_PATH}?agentId=${encodeURIComponent(agentId)}`,
    { waitUntil: "networkidle", timeout: 120000 },
  );
  await page.waitForTimeout(3000);
  for (let i = 0; i < 6; i++) {
    const cont = page.getByRole("button", { name: "Continue" });
    if (!(await cont.isVisible().catch(() => false))) break;
    await cont.click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: join(OUT, "step7-before-test.png"), fullPage: true });

  const buildBtn = page.getByRole("button", { name: /Build & start live test/i });
  if (await buildBtn.isVisible().catch(() => false)) {
    await buildBtn.click();
    await page.waitForTimeout(3000);
  }
  const startBtn = page.getByRole("button", { name: /Start V3 live test/i });
  await startBtn.waitFor({ state: "visible", timeout: 60000 });
  await startBtn.click();

  await page.waitForTimeout(25000);
  await page.screenshot({ path: join(OUT, "step7-after-start.png"), fullPage: true });

  const probeText = await page.locator("dl").first().textContent().catch(() => "");
  writeFileSync(join(OUT, "probe-ui.txt"), probeText || "");
  writeFileSync(join(OUT, "network.log"), networkLog.join("\n"));

  const usedV3 = networkLog.some((l) => l.includes("v3-wizard-live-test"));
  const usedTelnyx = networkLog.some((l) => l.includes("test-session"));
  report.STEP_7_V3_API_PATH = usedV3 ? "PASS" : "FAIL";
  report.TELNYX_V2_ASSISTANT_USED = usedTelnyx ? "TRUE" : "FALSE";
  report.STEP_7_BROWSER_OPENAI_LIVE_SESSION = probeText?.includes("wizard_draft_test")
    ? "PASS"
    : usedV3 && networkLog.some((l) => l.includes('"sessionId"'))
      ? "PASS"
      : "FAIL";

  const sessionMatch = networkLog.find((l) => l.includes("sessionId"));
  report.LIVE_SESSION_EVIDENCE = sessionMatch || "none";

  await browser.close();
  writeFileSync(join(OUT, "report.json"), JSON.stringify({ report, errors, networkLog }, null, 2));
  console.log("REPORT", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
