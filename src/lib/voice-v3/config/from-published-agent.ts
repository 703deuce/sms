import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { VoiceV3AgentConfig } from "./agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "./booking-agent-config";
import {
  compileVoiceV3AgentConfig,
  type VoiceV3ProviderConnections,
} from "./compile-voice-v3-agent-config";
import { resolveMicrosoftConnectionForWizard } from "./resolve-microsoft-connection";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import {
  logVoiceV3AgentConfigResolved,
  logVoiceV3ConfigFallbackUsed,
} from "./config-observability";
import { resolveWizardSnapshotForVoiceV3 } from "./resolve-wizard-snapshot-for-v3";
import { resolveAgentKnowledgeRetrieval } from "../knowledge/resolve-agent-knowledge-retrieval";
import {
  assertActiveAgentMayUseDemoConfigFallback,
  VoiceV3AgentConfigResolutionError,
  voiceV3AllowsDemoConfigFallback,
} from "./demo-config-fallback";

/** Appointment receptionist wizard agents use Voice V3 PSTN only — no optional flag. */
export function isAppointmentReceptionistAgent(config: VoiceAgentConfig): boolean {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

/** @deprecated Use isAppointmentReceptionistAgent — same contract, no feature flag. */
export function appointmentReceptionistUsesVoiceV3Runtime(config: VoiceAgentConfig): boolean {
  return isAppointmentReceptionistAgent(config);
}

async function resolveProviderConnectionsForWizard(
  workspaceId: string,
  wizard: AppointmentReceptionistWizardState | null,
): Promise<VoiceV3ProviderConnections> {
  const prisma = getPrisma();
  const bookingStrategy = wizard ? deriveBookingStrategyFromWizard(wizard) : null;
  const calendarProvider = wizard?.calendarProvider?.trim() || "microsoft";

  if (bookingStrategy === "GOOGLE_CALENDAR" || calendarProvider === "google") {
    const calendars = await prisma.voiceCalendarConnection.findMany({
      where: {
        workspaceId,
        provider: "google",
        status: { in: ["connected", "active", "ok"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (calendars.length === 0) {
      return {
        googleConnectionId: process.env.VOICE_V3_GOOGLE_CONNECTION_ID?.trim() || null,
        googleCalendarIds: ["primary"],
      };
    }
    const preferred = resolveMicrosoftConnectionForWizard(calendars, wizard?.calendarEmail);
    return {
      googleConnectionId: preferred?.id ?? calendars[0]?.id,
      googleCalendarIds: ["primary"],
    };
  }

  if (calendarProvider !== "microsoft" && bookingStrategy !== "MICROSOFT_365") {
    return {};
  }

  const calendars = await prisma.voiceCalendarConnection.findMany({
    where: {
      workspaceId,
      provider: "microsoft",
      status: { in: ["connected", "active", "ok"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (calendars.length === 0) {
    return {
      microsoftConnectionId:
        process.env.VOICE_V3_MICROSOFT_CONNECTION_ID?.trim() || null,
      microsoftCalendarIds: [
        process.env.VOICE_V3_CALENDAR_ID?.trim() || "primary",
      ],
    };
  }

  const preferred = resolveMicrosoftConnectionForWizard(calendars, wizard?.calendarEmail);

  return {
    microsoftConnectionId: preferred?.id ?? calendars[0]?.id,
    microsoftCalendarIds: [process.env.VOICE_V3_CALENDAR_ID?.trim() || "primary"],
    microsoftSmtp: null,
  };
}

export async function resolveVoiceV3AgentConfigForAgent(input: {
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
}): Promise<VoiceV3AgentConfig> {
  const envFallback = VOICE_V3_BOOKING_AGENT_CONFIG;
  try {
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { status: true, draftConfig: true },
    });
    const publishedRuntimeConfig = await loadVoiceAgentRuntimeConfig(
      input.workspaceId,
      input.agentId,
    );
    const { wizard, source } = resolveWizardSnapshotForVoiceV3({
      agentStatus: agent?.status ?? "ACTIVE",
      draftConfig: agent?.draftConfig,
      publishedRuntimeConfig,
    });
    if (!wizard) {
      logVoiceV3ConfigFallbackUsed("wizard", "appointmentReceptionistWizard_missing");
      if (agent?.status === "ACTIVE") {
        console.error("VOICE_V3_ACTIVE_AGENT_MISSING_WIZARD_SNAPSHOT", {
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          demo_fallback_allowed: voiceV3AllowsDemoConfigFallback(),
        });
      }
      assertActiveAgentMayUseDemoConfigFallback({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        agentStatus: agent?.status,
        reason: "appointmentReceptionistWizard_missing",
      });
      return envFallback;
    }

    const providerConnections = await resolveProviderConnectionsForWizard(
      input.workspaceId,
      wizard,
    );

    const retrieval = await resolveAgentKnowledgeRetrieval({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      wizard,
    });

    const compiled = compileVoiceV3AgentConfig({
      wizard,
      providerConnections,
      envFallback,
      source,
      knowledgeRetrieval: retrieval,
    });

    const withTenant: VoiceV3AgentConfig = {
      ...compiled,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    };

    logVoiceV3AgentConfigResolved({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      publishedVersionId: input.publishedVersionId,
      config: withTenant,
    });

    return withTenant;
  } catch (err) {
    if (err instanceof VoiceV3AgentConfigResolutionError) {
      throw err;
    }
    console.error("VOICE_V3_RESOLVE_AGENT_CONFIG_FAILED", {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      err,
    });
    logVoiceV3ConfigFallbackUsed("resolve", "exception");
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { status: true },
    });
    assertActiveAgentMayUseDemoConfigFallback({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      agentStatus: agent?.status,
      reason: "resolve_exception",
    });
    return envFallback;
  }
}
