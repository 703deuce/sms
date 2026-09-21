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
import {
  logVoiceV3AgentConfigResolved,
  logVoiceV3ConfigFallbackUsed,
} from "./config-observability";
import { resolveWizardSnapshotForVoiceV3 } from "./resolve-wizard-snapshot-for-v3";
import { resolveAgentKnowledgeRetrieval } from "../knowledge/resolve-agent-knowledge-retrieval";

/** Appointment receptionist wizard agents use Voice V3 PSTN only — no optional flag. */
export function isAppointmentReceptionistAgent(config: VoiceAgentConfig): boolean {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

/** @deprecated Use isAppointmentReceptionistAgent — same contract, no feature flag. */
export function appointmentReceptionistUsesVoiceV3Runtime(config: VoiceAgentConfig): boolean {
  return isAppointmentReceptionistAgent(config);
}

async function resolveMicrosoftProviderConnections(
  workspaceId: string,
  wizard: AppointmentReceptionistWizardState | null,
): Promise<VoiceV3ProviderConnections> {
  const prisma = getPrisma();
  const provider = wizard?.calendarProvider?.trim() || "microsoft";
  if (provider !== "microsoft") {
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
        });
      }
      return envFallback;
    }

    const providerConnections = await resolveMicrosoftProviderConnections(
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
    console.error("VOICE_V3_RESOLVE_AGENT_CONFIG_FAILED", {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      err,
    });
    logVoiceV3ConfigFallbackUsed("resolve", "exception");
    return envFallback;
  }
}
