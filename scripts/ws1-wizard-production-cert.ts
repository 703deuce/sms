#!/usr/bin/env npx tsx
/**
 * Production cert: update ws_1 appointment receptionist wizard (+15717491060) and publish.
 * Uses dev-bypass auth (production must have DEV_AUTH_BYPASS=1).
 */
import fs from "node:fs";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "../src/lib/solutions/appointment-receptionist/operating-maturity-wizard";

const BASE = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const TARGET_SHA = process.env.TARGET_COMMIT_SHA?.trim();
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const EMAIL = (process.env.DEV_AUTH_BYPASS_EMAIL || "anthony@transovo.ai").trim().toLowerCase();
const OUT = "/opt/cursor/artifacts/ws1-wizard-production-cert.json";

const CERT = {
  businessName: "WS1 Cert Plumbing Co",
  agentName: "Riley",
  companySummary:
    "WS1 Cert Plumbing is a licensed residential plumber in Northern Virginia. We specialize in emergency pipe repair, drain clearing, and water heater service.",
  pricingSummary:
    "Standard diagnostic visit is ninety-five dollars. Emergency after-hours dispatch fee is one hundred forty dollars. Hourly labor is one hundred twenty-five dollars.",
  serviceArea: "Northern Virginia only — Arlington, Fairfax, and Alexandria.",
  hoursNote: "Monday through Friday 8:00 AM to 5:00 PM Eastern. Closed Saturday and Sunday.",
};

const jar = new Map<string, string>();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  for (const c of anyHeaders.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function waitForDeploy() {
  const deadline = Date.now() + 15 * 60_000;
  while (Date.now() < deadline) {
    const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
    const sha = String((health as { commitSha?: string })?.commitSha || "");
    if (TARGET_SHA && sha.startsWith(TARGET_SHA.slice(0, 12))) return sha;
    if (!TARGET_SHA && sha.startsWith("d001625b")) return sha;
    await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error("Timed out waiting for production deploy");
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(),
      ...(init.headers || {}),
    },
  });
  storeCookies(res);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  return { res, json };
}

function buildCertState(existing: AppointmentReceptionistWizardState): AppointmentReceptionistWizardState {
  const state = { ...existing };
  state.agentId = AGENT_ID;
  state.businessName = CERT.businessName;
  state.agentName = CERT.agentName;
  state.voiceId = "cedar";
  state.voiceLabel = "Cedar";
  state.voiceSource = "builtin";
  state.speakingPace = "faster";
  state.voiceAccent = "neutral_american";
  state.calendarProvider = "microsoft";
  state.calendarConnected = true;
  state.calendarEmail = "anthony@transovo.ai";
  state.bookingStrategy = state.bookingStrategy || "MICROSOFT_LIVE_BOOK";
  state.capabilities = Array.from(
    new Set([...(state.capabilities || []), "book_appointments", "answer_questions", "take_messages"]),
  );
  state.knowledgeItems = [
    ...(state.knowledgeItems || []).filter((k) => !["business", "pricing", "hours", "service_area"].includes(k.id)),
    { id: "business", label: "Company", summary: CERT.companySummary, status: "ready", statusLabel: "Ready" },
    { id: "pricing", label: "Pricing", summary: CERT.pricingSummary, status: "ready", statusLabel: "Ready" },
    { id: "hours", label: "Hours", summary: CERT.hoursNote, status: "ready", statusLabel: "Ready" },
    { id: "service_area", label: "Service area", summary: CERT.serviceArea, status: "ready", statusLabel: "Ready" },
  ];
  const maturity = ensureWizardOperatingMaturity(state);
  maturity.businessSchedule.timezone = "America/New_York";
  const weekly = maturity.businessSchedule.weekly;
  for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"] as const) {
    weekly[day] = { closed: false, ranges: [{ start: "08:00", end: "17:00" }] };
  }
  for (const day of ["saturday", "sunday"] as const) {
    weekly[day] = { closed: true, ranges: [] };
  }
  state.operatingMaturity = maturity;
  state.timezone = "America/New_York";
  state.activationMode = "activate_now";
  state.openingGreeting = `Thank you for calling ${CERT.businessName}. This is ${CERT.agentName}. How can I help you today?`;
  return state;
}

async function main() {
  if (!BASE) throw new Error("Set APP_URL or NEXT_PUBLIC_APP_URL");
  const report: Record<string, unknown> = { base: BASE, cert: CERT, agentId: AGENT_ID };
  report.deployedCommitSha = await waitForDeploy();

  const login = await api("/api/auth/smoke-login", {
    method: "POST",
    headers: { "x-smoke-bootstrap": "transovo-smoke-bootstrap-b56f-aug2026" },
    body: JSON.stringify({ email: EMAIL, workspaceId: "ws_1" }),
  });
  report.smokeLogin = { status: login.res.status, body: login.json };
  if (!login.res.ok) {
    throw new Error(`smoke-login failed: ${login.res.status}`);
  }

  const loaded = await api(
    `/api/solutions/appointment-receptionist?agentId=${encodeURIComponent(AGENT_ID)}`,
  );
  report.loadStatus = loaded.res.status;
  const existing = (loaded.json as { data?: { state?: AppointmentReceptionistWizardState } })?.data?.state;
  if (!existing) {
    report.loadBody = loaded.json;
    throw new Error("Could not load existing wizard state for ws_1 agent");
  }

  const state = buildCertState(existing);
  const save = await api("/api/solutions/appointment-receptionist", {
    method: "POST",
    body: JSON.stringify({ action: "save_draft", state, wizardStepId: "activate" }),
  });
  report.saveDraft = { status: save.res.status, body: save.json };

  const publish = await api("/api/solutions/appointment-receptionist", {
    method: "POST",
    body: JSON.stringify({ action: "activate", state, wizardStepId: "activate" }),
  });
  report.publish = { status: publish.res.status, body: publish.json };
  report.ok = publish.res.ok;
  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("WS1_WIZARD_PRODUCTION_CERT", JSON.stringify(report, null, 2));
  if (!publish.res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
