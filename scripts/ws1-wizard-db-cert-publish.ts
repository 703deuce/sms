#!/usr/bin/env npx tsx
/**
 * ws_1 (+15717491060) wizard cert via DB — no browser auth required.
 * Updates draft, publishes, verifies compiled published wizard snapshot.
 */
import fs from "node:fs";
import { getPrisma } from "../src/lib/db";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { loadVoiceAgentRuntimeConfig } from "../src/lib/voice/load-agent-config";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "../src/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const OUT = "/opt/cursor/artifacts/ws1-wizard-production-cert.json";

export const WS1_CERT_PHONE = "+15717491060";

export const WS1_CERT_FACTS = {
  businessName: "WS1 Cert Plumbing Co",
  agentName: "Riley",
  companySummary:
    "WS1 Cert Plumbing is a licensed residential plumber in Northern Virginia. We specialize in emergency pipe repair, drain clearing, and water heater service.",
  pricingSummary:
    "Standard diagnostic visit is ninety-five dollars. Emergency after-hours dispatch fee is one hundred forty dollars. Hourly labor is one hundred twenty-five dollars.",
  serviceArea: "Northern Virginia only — Arlington, Fairfax, and Alexandria.",
  hoursNote: "Monday through Friday 8:00 AM to 5:00 PM Eastern. Closed Saturday and Sunday.",
  verificationQuestions: [
    "What is your standard diagnostic visit fee?",
    "Do you serve Southern California?",
    "What are your Saturday hours?",
    "What is the name of this plumbing company?",
    "Who am I speaking with on the phone?",
  ],
  expectedAnswers: [
    "Ninety-five dollars (or $95)",
    "No — Northern Virginia only",
    "Closed on Saturday",
    "WS1 Cert Plumbing Co",
    "Riley",
  ],
};

function buildCertState(existing: AppointmentReceptionistWizardState): AppointmentReceptionistWizardState {
  const state: AppointmentReceptionistWizardState = {
    ...createDefaultWizardState(),
    ...existing,
    bookingBehavior: existing.bookingBehavior ?? createDefaultWizardState().bookingBehavior,
    conversationBehaviors:
      existing.conversationBehaviors ?? createDefaultWizardState().conversationBehaviors,
    collectFields: existing.collectFields ?? createDefaultWizardState().collectFields,
    appointmentTypes: existing.appointmentTypes ?? createDefaultWizardState().appointmentTypes,
    capabilities: existing.capabilities ?? createDefaultWizardState().capabilities,
    guardrails: existing.guardrails ?? createDefaultWizardState().guardrails,
  };
  state.agentId = AGENT_ID;
  state.businessName = WS1_CERT_FACTS.businessName;
  state.agentName = WS1_CERT_FACTS.agentName;
  state.voiceId = "cedar";
  state.voiceLabel = "Cedar";
  state.voiceSource = "builtin";
  state.speakingPace = "faster";
  state.voiceAccent = "neutral_american";
  state.calendarProvider = "microsoft";
  state.calendarConnected = true;
  state.calendarEmail = "anthony@transovo.ai";
  state.capabilities = Array.from(
    new Set([...(state.capabilities || []), "book_appointments", "answer_questions", "take_messages"]),
  );
  state.knowledgeItems = [
    ...(state.knowledgeItems || []).filter((k) => !["business", "pricing", "hours", "service_area"].includes(k.id)),
    { id: "business", label: "Company", summary: WS1_CERT_FACTS.companySummary, status: "ready", statusLabel: "Ready" },
    { id: "pricing", label: "Pricing", summary: WS1_CERT_FACTS.pricingSummary, status: "ready", statusLabel: "Ready" },
    { id: "hours", label: "Hours", summary: WS1_CERT_FACTS.hoursNote, status: "ready", statusLabel: "Ready" },
    { id: "service_area", label: "Service area", summary: WS1_CERT_FACTS.serviceArea, status: "ready", statusLabel: "Ready" },
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
  state.openingGreeting = `Thank you for calling ${WS1_CERT_FACTS.businessName}. This is ${WS1_CERT_FACTS.agentName}. How can I help you today?`;
  state.bookingBehavior = state.bookingBehavior ?? {
    askPreferredDayFirst: true,
    offerEarliestThree: true,
    confirmBeforeBooking: true,
    sendSmsAfterBooking: false,
    askServiceFirst: false,
    distinguishNewExisting: false,
  };
  return state;
}

async function main() {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AGENT_ID, workspaceId: WORKSPACE_ID },
    include: { phoneNumber: { select: { e164: true } } },
  });
  if (!agent) throw new Error("Agent not found in ws_1");

  const loaded = await loadAppointmentReceptionistSetup(WORKSPACE_ID, { agentId: AGENT_ID });
  if (!loaded?.state) throw new Error("Could not load appointment receptionist wizard state");
  const state = buildCertState(loaded.state as AppointmentReceptionistWizardState);
  const { buildWizardAgentConfig } = await import(
    "../src/lib/solutions/appointment-receptionist/build-agent-config"
  );
  const draftConfig = buildWizardAgentConfig(state);

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, { draftConfig });
  const published = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, "ws1-wizard-db-cert");

  const runtime = await loadVoiceAgentRuntimeConfig(WORKSPACE_ID, AGENT_ID);
  const publishedLoaded = await loadAppointmentReceptionistSetup(WORKSPACE_ID, { agentId: AGENT_ID });
  const publishedWizard = publishedLoaded?.state as AppointmentReceptionistWizardState | undefined;
  const v3 = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    publishedVersionId: published.version.id,
  });

  const report = {
    ok: true,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    phoneE164: agent.phoneNumber?.e164,
    publishedVersion: published.version.version,
    businessName: publishedWizard?.businessName,
    agentName: publishedWizard?.agentName,
    calendarProvider: publishedWizard?.calendarProvider,
    calendarConnected: publishedWizard?.calendarConnected,
    v3BusinessName: v3.businessName,
    v3Voice: v3.telephony.liveVoiceId,
    v3PricingInPrompt: v3.business.pricingSummary,
    facts: WS1_CERT_FACTS,
  };

  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("WS1_WIZARD_DB_CERT_PUBLISH", JSON.stringify(report, null, 2));

  if (publishedWizard?.businessName !== WS1_CERT_FACTS.businessName) {
    throw new Error("Published wizard businessName mismatch");
  }
  if (v3.telephony.liveVoiceId !== "cedar") {
    throw new Error("V3 live voice mismatch");
  }
}

import path from "node:path";
import { fileURLToPath } from "node:url";

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
