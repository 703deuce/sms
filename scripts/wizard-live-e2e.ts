/**
 * Live E2E: create a voice agent on production using the same config the
 * Appointment Receptionist wizard generates, then verify draft + optional test session.
 *
 * Usage:
 *   BASE_URL=https://transovo.ai npx tsx scripts/wizard-live-e2e.ts
 */
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const OUT = "/opt/cursor/artifacts/wizard-qa/live-e2e.json";

const jar = new Map<string, string>();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res: Response) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.() || [];
  for (const c of list) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
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
    json = { raw: text.slice(0, 500) };
  }
  return { res, json };
}

async function main() {
  const report: Record<string, unknown> = { base: BASE, ok: false };

  const login = await api("/api/auth/smoke-login", {
    method: "POST",
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    body: JSON.stringify({ email: EMAIL }),
  });
  report.login = { status: login.res.status, body: login.json };
  if (!login.res.ok) {
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    throw new Error("smoke-login failed");
  }

  const numbers = await api("/api/phone/numbers");
  const phoneRows = ((numbers.json as { data?: Array<{ id: string; e164: string }> })?.data ||
    []) as Array<{ id: string; e164: string }>;
  report.phoneCount = phoneRows.length;

  const state = createDefaultWizardState();
  state.solutionName = `Wizard E2E Receptionist ${new Date().toISOString().slice(0, 19)}`;
  state.businessName = "Johnson Plumbing";
  state.agentName = "Maya";
  state.transferDestinationName = "Anthony Johnson";
  state.transferDestinationPhone = "+15555550199";
  state.websiteUrl = "https://www.johnsonplumbing.com";
  state.calendarConnected = true;
  state.calendarProvider = "google";
  if (phoneRows[0]) {
    state.phoneNumberId = phoneRows[0].id;
    state.phoneNumberE164 = phoneRows[0].e164;
  }

  const draftConfig = buildWizardAgentConfig(state);
  report.promptPreview = String(draftConfig.instructions?.system || "").slice(0, 240);
  report.voiceId = draftConfig.voiceLanguage?.voiceId;
  report.tools = draftConfig.enabledBuiltinTools;
  report.startupGreeting = (draftConfig.callHandling as { startupGreeting?: unknown })
    ?.startupGreeting;

  // Prefer dedicated wizard API when deployed; fall back to agents API.
  let agentId: string | null = null;
  const wizardApi = await api("/api/solutions/appointment-receptionist", {
    method: "POST",
    body: JSON.stringify({ action: "save_draft", state }),
  });
  report.wizardApi = { status: wizardApi.res.status, body: wizardApi.json };

  if (wizardApi.res.ok) {
    agentId = (wizardApi.json as { data?: { agentId?: string } })?.data?.agentId || null;
  } else {
    const created = await api("/api/voice/agents", {
      method: "POST",
      body: JSON.stringify({
        name: state.solutionName,
        agentType: "appointment_booking",
        templateId: "appointment_booking",
        description: "Answer Calls and Book Appointments — wizard e2e",
      }),
    });
    report.createAgent = { status: created.res.status, body: created.json };
    if (!created.res.ok) {
      fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
      throw new Error("create agent failed");
    }
    agentId = (created.json as { data?: { id?: string } })?.data?.id || null;
    if (!agentId) throw new Error("no agent id");

    const patched = await api(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: state.solutionName,
        displayName: state.agentName,
        purpose: "appointment_receptionist",
        phoneNumberId: state.phoneNumberId,
        draftConfig,
      }),
    });
    report.patchAgent = { status: patched.res.status, body: patched.json };
    if (!patched.res.ok) {
      fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
      throw new Error("patch agent failed");
    }
  }

  report.agentId = agentId;

  const got = await api(`/api/voice/agents/${agentId}`);
  const agent = (got.json as { data?: Record<string, unknown> })?.data || {};
  report.getAgent = {
    status: got.res.status,
    name: agent.name,
    statusLabel: agent.status,
    displayName: agent.displayName,
    phoneNumberId: agent.phoneNumberId,
    voiceId: (agent.draftConfig as { voiceLanguage?: { voiceId?: string } } | undefined)
      ?.voiceLanguage?.voiceId,
    hasPrompt: Boolean(
      (agent.draftConfig as { instructions?: { system?: string } } | undefined)?.instructions
        ?.system,
    ),
    startupMode: (
      agent.draftConfig as {
        callHandling?: { startupGreeting?: { mode?: string } };
      } | undefined
    )?.callHandling?.startupGreeting?.mode,
  };

  // Exercise browser/text test endpoint if present
  const testSession = await api(`/api/voice/agents/${agentId}/test-session`, {
    method: "POST",
    body: JSON.stringify({ scenario: "appointment_booking" }),
  });
  report.testSession = { status: testSession.res.status, body: testSession.json };

  const textTest = await api(`/api/voice/agents/${agentId}/test`, {
    method: "POST",
    body: JSON.stringify({
      message: "Can I book something tomorrow morning?",
    }),
  });
  report.textTest = { status: textTest.res.status, body: textTest.json };

  report.ok =
    got.res.ok &&
    Boolean(agentId) &&
    Boolean(
      (agent.draftConfig as { instructions?: { system?: string } } | undefined)?.instructions
        ?.system,
    );

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
