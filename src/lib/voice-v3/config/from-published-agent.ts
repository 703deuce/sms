import "server-only";

import { getPrisma } from "@/lib/db";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { compileVoiceV2IntakeSchema } from "@/lib/voice-receptionist-wizard/intake/compile-schema";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { IntakeFieldType, VoiceV3AgentConfig } from "./agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "./booking-agent-config";

function mapValueType(t: string): IntakeFieldType {
  if (t === "email") return "email";
  if (t === "phone") return "phone";
  return "text";
}

function wizardFromConfig(config: VoiceAgentConfig): AppointmentReceptionistWizardState | null {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const w = advanced.appointmentReceptionistWizard;
  if (!w || typeof w !== "object") return null;
  return w as AppointmentReceptionistWizardState;
}

/** Appointment receptionist wizard agents use Voice V3 PSTN only — no optional flag. */
export function isAppointmentReceptionistAgent(config: VoiceAgentConfig): boolean {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

/** @deprecated Use isAppointmentReceptionistAgent — same contract, no feature flag. */
export function appointmentReceptionistUsesVoiceV3Runtime(config: VoiceAgentConfig): boolean {
  return isAppointmentReceptionistAgent(config);
}

export async function resolveVoiceV3AgentConfigForAgent(input: {
  workspaceId: string;
  agentId: string;
}): Promise<VoiceV3AgentConfig> {
  const envFallback = VOICE_V3_BOOKING_AGENT_CONFIG;
  try {
    const config = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
    const wizard = wizardFromConfig(config);
    const schema = compileVoiceV2IntakeSchema(config);
    const intakeFields =
      schema.fields.length > 0
        ? schema.fields.map((f) => {
            const type = mapValueType(f.valueType);
            const description =
              f.description?.trim() ||
              f.label?.trim() ||
              `Caller ${f.label || f.key}.`;
            return {
              key: f.key,
              label: f.label,
              type,
              required: f.requirementLevel !== "OPTIONAL",
              description,
              collectionStrategy: type === "email" ? "voice_email" : "standard",
              verificationRequired: type === "email" ? false : undefined,
            };
          })
        : envFallback.intakeFields;

    const enabledType =
      wizard?.appointmentTypes?.find((t) => t.enabled) || wizard?.appointmentTypes?.[0];
    const service = {
      id: enabledType?.id || envFallback.service.id,
      name: enabledType?.name?.trim() || envFallback.service.name,
      durationMinutes: enabledType?.durationMinutes || envFallback.service.durationMinutes,
      slotStepMinutes: envFallback.service.slotStepMinutes,
    };

    const prisma = getPrisma();
    const calendar = await prisma.voiceCalendarConnection.findFirst({
      where: {
        workspaceId: input.workspaceId,
        provider: "microsoft",
        status: { in: ["connected", "active", "ok"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    const connectionId =
      calendar?.id?.trim() ||
      process.env.VOICE_V3_MICROSOFT_CONNECTION_ID?.trim() ||
      envFallback.calendar?.connectionId ||
      "";

    const timezone =
      wizard?.timezone?.trim() ||
      config.timezone?.trim() ||
      envFallback.timezone;

    return {
      businessName:
        wizard?.businessName?.trim() ||
        config.businessName?.trim() ||
        envFallback.businessName,
      timezone,
      intake: envFallback.intake,
      intakeFields,
      operationRequirements: envFallback.operationRequirements,
      service,
      businessHours: envFallback.businessHours,
      calendar: {
        provider: "microsoft",
        connectionId,
        calendarIds: [process.env.VOICE_V3_CALENDAR_ID?.trim() || "primary"],
        smtp: envFallback.calendar?.smtp ?? null,
      },
    };
  } catch (err) {
    console.error("VOICE_V3_RESOLVE_AGENT_CONFIG_FAILED", {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      err,
    });
    return envFallback;
  }
}
