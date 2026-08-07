/**
 * Post-live-call verification via browser UI (transovo.ai).
 * Checks: Activity trace, Results metrics, booking verification, Talk recall.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/amy-post-call-verify";
const EMAIL = process.env.AMY_EMAIL || "703deuce@gmail.com";
const WORKSPACE_ID = process.env.AMY_WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";

fs.mkdirSync(OUT, { recursive: true });
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const report = {
  base: BASE,
  runId: RUN_ID,
  email: EMAIL,
  agentId: AGENT_ID,
  workspaceId: WORKSPACE_ID,
  startedAt: new Date().toISOString(),
  checks: {},
  talkResponse: null,
  errors: [],
};

function log(msg, detail = {}) {
  console.log(`→ ${msg}`, JSON.stringify(detail).slice(0, 200));
}

async function shot(page, name) {
  const path = `${OUT}/${RUN_ID}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
  log("logged in", { email: body.email, workspace: body.workspaceName });
}

async function waitForAmy(page) {
  await page.goto(`${BASE}/agents/${AGENT_ID}`, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 60; i++) {
    const text = await page.locator("body").innerText();
    if (!/Loading Amy/i.test(text) && /Talk to/i.test(text)) return;
    await page.waitForTimeout(1000);
  }
  throw new Error("Amy workspace did not load");
}

async function waitReady(page) {
  for (let i = 0; i < 90; i++) {
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) return;
    await page.waitForTimeout(500);
  }
}

async function control(page, command, payload = {}) {
  const res = await page.request.post(`${BASE}/api/agents/${AGENT_ID}/control`, {
    data: { command, payload },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), data: json.data, raw: json };
}

async function askAmy(page, text) {
  await page.goto(`${BASE}/agents/${AGENT_ID}?section=talk`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await waitReady(page);
  const input = page.getByPlaceholder(/Message/i);
  await input.fill(text);
  await page.getByRole("button", { name: /^Send$/i }).click();
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(1000);
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) break;
  }
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  return body;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);

  try {
    await smokeLogin(page);
    await waitForAmy(page);
    await shot(page, "01-workspace-loaded");

    // Agent summary + metrics from API (same session as UI)
    const agentRes = await page.request.get(`${BASE}/api/agents/${AGENT_ID}`);
    const agentJson = await agentRes.json().catch(() => ({}));
    const agent = agentJson.data || {};
    report.checks.agent = {
      name: agent.identity?.displayName,
      phone: agent.phoneNumberE164 || agent.resources?.numberLabel,
      calendar: agent.resources?.calendarLabel,
      metrics: agent.metrics,
      health: agent.health?.overall,
    };
    log("agent metrics", agent.metrics);

    // Activity via control API (same as Work > Activity tab)
    const activity = await control(page, "search_agent_activity", { limit: 10 });
    const traces = activity.data?.traces || [];
    report.checks.activity = {
      count: traces.length,
      traces: traces.map((t) => ({
        callId: t.callId,
        summary: t.summary,
        outcome: t.outcome,
        startedAt: t.startedAt,
      })),
    };
    log("activity traces", { count: traces.length, latest: traces[0]?.summary });

    // Booking verification for latest call
    const latestCallId = traces[0]?.callId;
    if (latestCallId) {
      const verify = await control(page, "get_booking_verification", { callId: latestCallId });
      report.checks.bookingVerification = verify.data;
      log("booking verification", verify.data);

      const timeline = await control(page, "get_employee_timeline", { callId: latestCallId });
      report.checks.timeline = timeline.data?.timeline || [];
      log("timeline steps", { count: report.checks.timeline.length });
    } else {
      report.errors.push("No activity traces found — call may not have been recorded");
    }

    // UI: Work > Activity
    await page.getByRole("button", { name: /^Work$/i }).first().click();
    await page.waitForTimeout(1500);
    await shot(page, "02-work-activity");
    const activityUi = await page.locator("body").innerText();
    report.checks.activityUiVisible = !/No recent call activity yet/i.test(activityUi);

    // UI: Work > Results
    await page.getByRole("button", { name: /^Results$/i }).first().click();
    await page.waitForTimeout(1000);
    await shot(page, "03-work-results");
    const resultsUi = await page.locator("body").innerText();
    const bookedMatch = resultsUi.match(/Booked[\s\S]*?(\d+)/);
    const smsMatch = resultsUi.match(/SMS confirmations[\s\S]*?(\d+)/);
    const callsMatch = resultsUi.match(/Calls[\s\S]*?(\d+)/);
    report.checks.resultsUi = {
      calls: callsMatch ? Number(callsMatch[1]) : null,
      booked: bookedMatch ? Number(bookedMatch[1]) : null,
      smsConfirmations: smsMatch ? Number(smsMatch[1]) : null,
      rawSnippet: resultsUi.slice(0, 800),
    };
    log("results UI", report.checks.resultsUi);

    // Talk: "What happened on the last call?"
    const talkBody = await askAmy(page, "What happened on the last call?");
    await shot(page, "04-talk-last-call");
    report.talkResponse = talkBody;
    report.checks.talkMentionsCall =
      /call|book|appointment|sms|calendar|caller/i.test(talkBody) &&
      !/I don't have|no recent|couldn't find/i.test(talkBody);

    // Talk: request a policy change (agent-control loop)
    const changeBody = await askAmy(page, "Change my minimum booking notice to four hours.");
    await shot(page, "05-talk-notice-change");
    report.checks.noticeChangeResponse = changeBody.slice(-1200);
    report.checks.noticeProposalDetected =
      /proposal|confirm|four hours|4 hours|minimum notice/i.test(changeBody);

    report.finishedAt = new Date().toISOString();
    report.ok =
      report.errors.length === 0 &&
      report.checks.activity.count > 0 &&
      (report.checks.bookingVerification?.calendarEventVerified ||
        report.checks.bookingVerification?.overall === "completed" ||
        report.checks.bookingVerification?.overall === "accepted") &&
      (report.checks.resultsUi?.booked > 0 || report.checks.bookingVerification?.outcomeStored) &&
      report.checks.talkMentionsCall;

    fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
    console.log("\n=== POST-CALL REPORT ===");
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    await shot(page, "zz-error").catch(() => null);
    fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
    console.error(err);
  } finally {
    await browser.close();
  }

  process.exit(report.ok ? 0 : 1);
}

main();
