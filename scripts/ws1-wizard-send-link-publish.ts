#!/usr/bin/env npx tsx
/**
 * ws_1 (+15717491060) — configure SEND_LINK booking + publish (wizard-equivalent via DB).
 */
import fs from "node:fs";
import { getPrisma } from "../src/lib/db";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { loadAppointmentReceptionistSetup } from "../src/lib/solutions/appointment-receptionist/save-setup";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "../src/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { resolveVoiceV3AgentConfigForAgent } from "../src/lib/voice-v3/config/from-published-agent";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import {
  WS1_CERT_FACTS,
  WS1_CERT_PHONE,
} from "./ws1-wizard-db-cert-publish";

const WORKSPACE_ID = "ws_1";
const AGENT_ID = process.env.VOICE_AGENT_ID?.trim() || "cmshz2lc25c622c4i58303501";
const SMS_PHONE_ID = process.env.SMS_PHONE_NUMBER_ID?.trim() || "cmtokonyy57004g58242i4c2o";
const SMS_E164 = process.env.SMS_PHONE_E164?.trim() || "+15717491060";
const BOOKING_LINK_URL = process.env.BOOKING_LINK_URL?.trim();
if (!BOOKING_LINK_URL) {
  throw new Error("Set BOOKING_LINK_URL (https public booking page) before running.");
}
const LIVE_VOICE_ID = process.env.VOICE_V3_LIVE_VOICE?.trim() || "ballad";
const OUT = "/opt/cursor/artifacts/ws1-wizard-send-link-publish.json";

function buildSendLinkState(existing: AppointmentReceptionistWizardState): AppointmentReceptionistWizardState {
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
  state.voiceId = LIVE_VOICE_ID;
  state.voiceLabel = LIVE_VOICE_ID.charAt(0).toUpperCase() + LIVE_VOICE_ID.slice(1);
  state.voiceSource = "builtin";
  state.speakingPace = "faster";
  state.voiceAccent = "neutral_american";
  state.bookingStrategy = "SEND_LINK";
  state.bookingLinkUrl = BOOKING_LINK_URL;
  state.bookingLinkLabel = "Book your appointment";
  state.bookingLinkSmsConsentRequired = true;
  state.outboundSmsMode = "explicit_number";
  state.outboundSmsPhoneNumberId = SMS_PHONE_ID;
  state.outboundSmsE164 = SMS_E164;
  state.calendarProvider = "none";
  state.calendarConnected = false;
  state.calendarEmail = null;
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
  const state = buildSendLinkState(loaded.state as AppointmentReceptionistWizardState);
  const { buildWizardAgentConfig } = await import(
    "../src/lib/solutions/appointment-receptionist/build-agent-config"
  );
  const draftConfig = buildWizardAgentConfig(state);

  await updateVoiceAgentDraft(WORKSPACE_ID, AGENT_ID, { draftConfig });
  const published = await publishVoiceAgent(WORKSPACE_ID, AGENT_ID, "ws1-wizard-send-link-publish");

  const v3 = await resolveVoiceV3AgentConfigForAgent({
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    publishedVersionId: published.version.id,
  });

  const tools = listVoiceV3AstraToolNamesForConfig(v3);
  const report = {
    ok: true,
    workspaceId: WORKSPACE_ID,
    agentId: AGENT_ID,
    voiceLineE164: agent.phoneNumber?.e164 ?? WS1_CERT_PHONE,
    smsFromE164: SMS_E164,
    publishedVersion: published.version.version,
    bookingStrategy: v3.scheduling.bookingStrategy,
    bookingLinkUrl: v3.bookingStrategyDetail.bookingLinkUrl,
    liveVoiceId: v3.telephony.liveVoiceId,
    outboundSmsE164: v3.telephony.outboundSmsE164,
    astraTools: tools,
    hasSendBookingLink: tools.includes("send_booking_link"),
    hasBookAppointment: tools.includes("book_appointment"),
  };

  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("WS1_WIZARD_SEND_LINK_PUBLISH", JSON.stringify(report, null, 2));

  if (v3.scheduling.bookingStrategy !== "SEND_LINK") {
    throw new Error(`Expected SEND_LINK, got ${v3.scheduling.bookingStrategy}`);
  }
  if (!report.hasSendBookingLink) throw new Error("send_booking_link tool missing from catalog");
  if (report.hasBookAppointment) throw new Error("book_appointment should not be exposed for SEND_LINK");
  if (v3.telephony.liveVoiceId !== LIVE_VOICE_ID) {
    throw new Error(`Voice mismatch: ${v3.telephony.liveVoiceId}`);
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
