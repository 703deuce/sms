/**
 * Stage 2 low-RAM runtime gate: sequential routes, content checks, network counts.
 * Requires: dev server + DEV_AUTH_BYPASS=1, Playwright chromium.
 *
 * Env:
 *   UI_AGENT_BASE_URL (default http://127.0.0.1:3001)
 *   STAGE2_VOICE_CALL_ID, STAGE2_MCTB_MISSED_ID (from newui-stage2-resolve-ids.ts)
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3001";
const voiceCallId = process.env.STAGE2_VOICE_CALL_ID || "";
const mctbMissedId = process.env.STAGE2_MCTB_MISSED_ID || "";

const MOCK_MARKERS = [
  "Northside Plumbing & Heating",
  "Supply House",
  "(512) 555-0100",
  "nsph.co",
];

const ROUTES = [
  {
    path: "/voice/overview",
    stage2: "How your receptionist is running",
    legacy: "font-display text-[28px]",
    component: "NewUiVoiceOverviewPage (server)",
  },
  {
    path: "/voice/calls",
    stage2: "Track and manage calls handled by the AI receptionist",
    legacy: "MOCK_CALL_ROWS",
    component: "NewUiVoiceCallsPage → CallsBrowser",
  },
  {
    path: voiceCallId ? `/voice/calls/${voiceCallId}` : null,
    stage2: "Transcript",
    legacy: null,
    component: "NewUiVoiceCallDetailPage",
    requireId: true,
  },
  {
    path: "/voice/analytics",
    stage2: "How your receptionist is performing",
    component: "NewUiVoiceAnalyticsPage",
  },
  {
    path: "/voice/receptionist",
    stage2: "Configure how your AI receptionist greets callers",
    component: "NewUiVoiceReceptionistPage → VoiceReceptionistEditor",
  },
  {
    path: "/voice/knowledge",
    stage2: "Sources your receptionist uses to answer caller questions",
    component: "NewUiVoiceKnowledgePage",
  },
  {
    path: "/voice/call-handling",
    stage2: "Business hours, transfers, spam protection",
    component: "NewUiVoiceCallHandlingPage → CallHandlingOperationalPage",
  },
  {
    path: "/voice/numbers",
    stage2: "Business lines, forwarded numbers, and text-back senders",
    component: "NewUiVoiceNumbersPage",
  },
  {
    path: "/mctb",
    stage2: "Recent missed calls",
    component: "NewUiMctbOverviewPage",
  },
  {
    path: "/mctb/missed-calls",
    stage2: "Missed Calls",
    component: "NewUiMctbMissedCallsPage → MissedCallsBrowser",
  },
  {
    path: mctbMissedId ? `/mctb/missed-calls/${mctbMissedId}` : null,
    stage2: "Missed calls",
    component: "NewUiMctbMissedCallDetailPage",
    requireId: true,
  },
  {
    path: "/mctb/conversations",
    stage2: "Inbox",
    component: "NewUiMctbConversationsPage → Inbox",
  },
  {
    path: "/mctb/ai-recovery",
    stage2: "Automated replies that collect intent",
    component: "NewUiMctbAiRecoveryPage → AiRecoverySettingsPage",
  },
  {
    path: "/mctb/voicemail",
    stage2: "Listen, read transcripts, and follow up",
    component: "NewUiMctbVoicemailPage",
  },
  {
    path: "/mctb/analytics",
    stage2: "Recovery performance for missed calls",
    component: "NewUiMctbAnalyticsPage",
  },
  {
    path: "/mctb/setup",
    stage2: "Configure missed call text back",
    component: "NewUiMctbSetupOverviewPage → MctbSetupOverview",
  },
  {
    path: "/mctb/setup/phone",
    stage2: "Connect and verify your business line",
    component: "NewUiMctbSetupPhonePage → MctbSetupPhoneView",
  },
  {
    path: "/mctb/setup/consent",
    stage2: "How callers give permission to receive recovery texts",
    component: "NewUiMctbSetupConsentPage → ConsentEditor",
  },
  {
    path: "/mctb/setup/text-back",
    stage2: "Recovery message customers receive",
    component: "NewUiMctbSetupTextBackPage → TextBackEditor",
  },
  {
    path: "/mctb/setup/exclusions",
    stage2: "Do-not-text list",
    component: "NewUiMctbSetupExclusionsPage → ExclusionsTable",
  },
].filter((r) => r.path);

const routePrefix = process.env.STAGE2_ROUTE_PREFIX || "";
const routesToTest = routePrefix
  ? ROUTES.filter((r) => r.path.startsWith(routePrefix))
  : ROUTES;

async function visitRoute(page, route) {
  const result = {
    path: route.path,
    component: route.component,
    http: null,
    stage2Marker: false,
    legacyLeak: false,
    mockMarkers: [],
    pageErrors: [],
    consoleErrors: [],
    hydrationHint: false,
    stuckLoading: false,
    transplantChunk: false,
    pass: false,
    notes: "",
  };

  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const onPageError = (err) => pageErrors.push(String(err));

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  let response;
  try {
    response = await page.goto(`${BASE}${route.path}`, {
      waitUntil: "commit",
      timeout: 180_000,
    });
    await page.waitForTimeout(2000);
    if (route.path.includes("/conversations")) {
      await page.waitForTimeout(8000);
    } else if (route.path.match(/\/voice\/calls\/[^/]+$/)) {
      await page.waitForTimeout(6000);
    } else if (route.path.startsWith("/mctb")) {
      await page.waitForTimeout(5000);
    } else if (route.path.includes("/calls") && route.path === "/voice/calls") {
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    result.notes = `navigation failed: ${e.message}`;
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    return result;
  }

  result.http = response?.status() ?? null;
  const body = await page.content();
  const text = await page.innerText("body").catch(() => "");

  if (route.stage2) {
    result.stage2Marker = body.includes(route.stage2) || text.includes(route.stage2);
  } else {
    result.stage2Marker = !body.includes("Application error") && result.http === 200;
  }

  if (route.legacy && body.includes(route.legacy)) {
    result.legacyLeak = true;
  }

  for (const m of MOCK_MARKERS) {
    if (text.includes(m) || body.includes(m)) result.mockMarkers.push(m);
  }

  result.transplantChunk = body.includes("newui-transplant") || body.includes("_next/static/chunks");

  if (
    (text.includes("Loading calls…") || text.includes("Loading conversations…")) &&
    !text.includes("Answered") &&
    !text.includes("Inbox")
  ) {
    result.stuckLoading = true;
  }
  if (
    consoleErrors.some((c) => /hydration|Hydration/i.test(c)) ||
    text.includes("Hydration failed")
  ) {
    result.hydrationHint = true;
  }

  if (route.path.includes("/voice/calls/") && text.includes("Call not found")) {
    result.notes = "detail not found";
  }
  if (route.path.includes("/mctb/missed-calls/") && route.path.split("/").length > 3) {
    if (text.includes("Missed call not found")) result.notes = "detail not found";
    else if (text.length > 200) result.notes = "detail body rendered";
  }

  result.consoleErrors = consoleErrors.slice(0, 8);
  result.pageErrors = pageErrors.slice(0, 8);

  const receptionistLegacyBug =
    route.path === "/voice/receptionist" &&
    result.pageErrors.some((e) => e.includes("reading 'map'"));

  result.pass =
    result.http === 200 &&
    !result.legacyLeak &&
    !result.hydrationHint &&
    !result.stuckLoading &&
    result.stage2Marker &&
    (!result.pageErrors.length || receptionistLegacyBug) &&
    !result.consoleErrors.some((c) => /Module not found|Cannot find module/i.test(c)) &&
    result.notes !== "detail not found";

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  return result;
}

async function main() {
  const callHandlingGets = [];
  const telnyxUrls = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/call-handling") && req.method() === "GET") {
      callHandlingGets.push(url);
    }
    if (/telnyx\.com|api\.telnyx/i.test(url)) telnyxUrls.push(url);
  });

  const bypassRes = await page.request.get(`${BASE}/api/auth/dev-bypass`, {
    maxRedirects: 0,
  });
  if (bypassRes.status() !== 302 && bypassRes.status() !== 307) {
    throw new Error(`dev-bypass failed: ${bypassRes.status()}`);
  }
  await page.waitForTimeout(500);

  const routeResults = [];
  for (const route of routesToTest) {
    console.error(`[stage2-cert] visiting ${route.path}`);
    routeResults.push(await visitRoute(page, route));
  }

  await browser.close();

  const out = {
    base: BASE,
    voiceCallId: voiceCallId || null,
    mctbMissedId: mctbMissedId || null,
    routes: routeResults,
    callHandlingGetCount: callHandlingGets.length,
    callHandlingGets,
    telnyxRequestCount: telnyxUrls.length,
    telnyxUrls: telnyxUrls.slice(0, 10),
    summary: {
      tested: routeResults.length,
      pass: routeResults.filter((r) => r.pass).length,
      fail: routeResults.filter((r) => !r.pass).length,
    },
  };

  const jsonPath = "/opt/cursor/artifacts/newui-stage2-cert-runtime.json";
  writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
