import "server-only";

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { attachVoiceV3LiveSideband } from "@/lib/voice-v3/live-sideband-session";
import { createVoiceV3CallRuntime, voiceV3IntakePipelineEnabled } from "@/lib/voice-v3/state/call-runtime";
import {
  compileVoiceV3AgentConfig,
  type VoiceV3ProviderConnections,
} from "@/lib/voice-v3/config/compile-voice-v3-agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "@/lib/voice-v3/config/booking-agent-config";
import { isAppointmentReceptionistAgent } from "@/lib/voice-v3/config/wizard-test-compilation";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { getVoiceV3BasicOpenAiClient } from "./openai-client";
import {
  buildBasicLiveMediaSession,
  VOICE_V3_BASIC_BACKEND_MODEL,
  VOICE_V3_BASIC_LIVE_MODEL,
} from "./live-session-config";
import { resolveMicrosoftConnectionForWizard } from "@/lib/voice-v3/config/resolve-microsoft-connection";

export type WizardV3BrowserLiveTestResult =
  | {
      ok: true;
      sessionId: string;
      answerSdp: string;
      source: "wizard_draft_test";
      configVersion: string;
      agentId: string;
      agentName: string;
      liveVoiceId: string;
      intakeFieldKeys: string[];
      bookingStrategy: string;
      liveModel: string;
      backendModel: string;
    }
  | { ok: false; code: string; error: string; status: number };

function wizardFromDraft(config: ReturnType<typeof parseVoiceAgentConfig>): AppointmentReceptionistWizardState | null {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const w = advanced.appointmentReceptionistWizard;
  if (!w || typeof w !== "object") return null;
  return w as AppointmentReceptionistWizardState;
}

async function resolveMicrosoftForWizard(
  workspaceId: string,
  wizard: AppointmentReceptionistWizardState,
): Promise<VoiceV3ProviderConnections> {
  const prisma = getPrisma();
  const provider = wizard.calendarProvider?.trim() || "microsoft";
  if (provider !== "microsoft") return {};
  const calendars = await prisma.voiceCalendarConnection.findMany({
    where: {
      workspaceId,
      provider: "microsoft",
      status: { in: ["connected", "active", "ok"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!calendars.length) {
    return {
      microsoftConnectionId: process.env.VOICE_V3_MICROSOFT_CONNECTION_ID?.trim() || null,
      microsoftCalendarIds: [process.env.VOICE_V3_CALENDAR_ID?.trim() || "primary"],
    };
  }
  const preferred = resolveMicrosoftConnectionForWizard(calendars, wizard.calendarEmail);
  return {
    microsoftConnectionId: preferred?.id ?? calendars[0]?.id,
    microsoftCalendarIds: [process.env.VOICE_V3_CALENDAR_ID?.trim() || "primary"],
    microsoftSmtp: null,
  };
}

/**
 * Wizard Step 7 browser test — same compiled Voice V3 config + sideband tool runtime as PSTN.
 */
export async function createWizardV3BrowserLiveTest(input: {
  workspaceId: string;
  userId: string;
  agentId: string;
  offerSdp: string;
}): Promise<WizardV3BrowserLiveTestResult> {
  const offerSdp = input.offerSdp?.trim();
  if (!offerSdp) {
    return { ok: false, code: "invalid_sdp", error: "WebRTC offer SDP is required", status: 400 };
  }

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) {
    return { ok: false, code: "not_found", error: "Agent not found", status: 404 };
  }
  if (agent.emergencyDisabled) {
    return { ok: false, code: "emergency_disabled", error: "Agent is emergency-stopped", status: 403 };
  }

  const draftConfig = parseVoiceAgentConfig(agent.draftConfig);
  if (!isAppointmentReceptionistAgent(draftConfig)) {
    return {
      ok: false,
      code: "not_appointment_receptionist",
      error: "Voice V3 wizard browser test is only for Appointment Receptionist agents",
      status: 400,
    };
  }

  const wizard = wizardFromDraft(draftConfig);
  if (!wizard) {
    return {
      ok: false,
      code: "wizard_missing",
      error: "Save the wizard draft before starting a live test",
      status: 400,
    };
  }

  const providerConnections = await resolveMicrosoftForWizard(input.workspaceId, wizard);
  const compiled = compileVoiceV3AgentConfig({
    wizard,
    providerConnections,
    envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
    source: "wizard_draft_test",
  });

  const client = getVoiceV3BasicOpenAiClient();
  const mediaSession = buildBasicLiveMediaSession(new Date(), compiled);

  let created;
  try {
    created = await client.live.create({
      session: mediaSession,
      transport: { type: "webrtc", sdp: offerSdp },
    });
  } catch (err) {
    console.error("VOICE_V3_WIZARD_BROWSER_LIVE_CREATE_FAILED", err);
    return {
      ok: false,
      code: "live_create_failed",
      error: err instanceof Error ? err.message : "OpenAI Live session failed",
      status: 502,
    };
  }

  const sessionId = created.session.id;
  if (voiceV3IntakePipelineEnabled()) {
    createVoiceV3CallRuntime({
      liveSessionId: sessionId,
      callId: sessionId,
      config: compiled,
    });
  }

  attachVoiceV3LiveSideband({ sessionId, callId: sessionId, client });

  console.log("VOICE_V3_WIZARD_BROWSER_LIVE_STARTED", {
    sessionId,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    source: "wizard_draft_test",
    configVersion: compiled.configVersion,
    liveVoiceId: compiled.telephony?.liveVoiceId,
    agentName: compiled.identity?.agentName,
  });

  return {
    ok: true,
    sessionId,
    answerSdp: created.transport.sdp,
    source: "wizard_draft_test",
    configVersion: compiled.configVersion ?? "",
    agentId: input.agentId,
    agentName: compiled.identity?.agentName ?? "",
    liveVoiceId: compiled.telephony?.liveVoiceId ?? "marin",
    intakeFieldKeys: compiled.intakeFields.map((f) => f.key),
    bookingStrategy: compiled.scheduling.bookingStrategy,
    liveModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
  };
}

export async function endWizardV3BrowserLiveTest(input: {
  workspaceId: string;
  agentId: string;
  sessionId: string;
}): Promise<void> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!agent) return;
  const sessionId = input.sessionId.trim();
  if (!sessionId) return;
  try {
    const client = getVoiceV3BasicOpenAiClient();
    await client.live.sessions.hangup(sessionId);
  } catch (err) {
    console.warn("VOICE_V3_WIZARD_BROWSER_LIVE_HANGUP_FAILED", { sessionId, err });
  }
}
