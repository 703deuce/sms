import type { AppointmentReceptionistWizardState } from "../types";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { fingerprintValue } from "./redact";

export type ReceptionistRuntimeSummary = {
  bookingMode: string;
  bookingToolsExpected: string[];
  transferEnabled: boolean;
  transferToolsExpected: string[];
  voiceId: string;
  configFingerprint: string;
  capabilities: string[];
  publishedMode: "production" | "isolated_test" | "draft_compile";
};

function bookingDisabled(state: AppointmentReceptionistWizardState): boolean {
  return !state.capabilities?.includes("book_appointments");
}

export function resolveBookingMode(state: AppointmentReceptionistWizardState): string {
  if (bookingDisabled(state)) return "BOOKING_DISABLED";
  const strategy = state.bookingStrategy || "MICROSOFT_365";
  return String(strategy);
}

export function expectedBookingTools(state: AppointmentReceptionistWizardState): string[] {
  if (bookingDisabled(state)) return [];
  const strategy = state.bookingStrategy || "MICROSOFT_365";
  if (strategy === "SEND_LINK") return ["send_booking_link"];
  if (strategy === "CALENDLY") return ["calendly_booking"];
  return ["find_appointment_slots", "book_appointment"];
}

export function transferEnabled(state: AppointmentReceptionistWizardState): boolean {
  if (state.voiceV2HumanTransferEnabled === false) return false;
  if (state.transferTriggers?.length) return true;
  if (state.transferDestinationPhone?.trim()) return true;
  if (state.transferDestinations?.some((d) => d.enabled !== false && d.phoneE164?.trim())) {
    return true;
  }
  return false;
}

export function expectedTransferTools(state: AppointmentReceptionistWizardState): string[] {
  if (!transferEnabled(state)) return [];
  return ["transfer_call", "warm_transfer"];
}

export function summarizeWizardRuntime(
  state: AppointmentReceptionistWizardState,
  mode: ReceptionistRuntimeSummary["publishedMode"],
): ReceptionistRuntimeSummary {
  const voiceId = state.voiceId || state.openAiCustomVoiceId || "unknown";
  return {
    bookingMode: resolveBookingMode(state),
    bookingToolsExpected: expectedBookingTools(state),
    transferEnabled: transferEnabled(state),
    transferToolsExpected: expectedTransferTools(state),
    voiceId: String(voiceId),
    configFingerprint: fingerprintValue({
      capabilities: state.capabilities,
      bookingStrategy: state.bookingStrategy,
      voiceId: state.voiceId,
      transfer: transferEnabled(state),
    }),
    capabilities: [...(state.capabilities || [])],
    publishedMode: mode,
  };
}

export function summarizeCompiledConfig(
  config: VoiceAgentConfig,
  mode: ReceptionistRuntimeSummary["publishedMode"],
): ReceptionistRuntimeSummary & { enabledTools?: string[] } {
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  const wizard = advanced.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
  const compiled = advanced.receptionistCompiled as Record<string, unknown> | undefined;
  const enabledTools = Array.isArray(compiled?.enabledBuiltinTools)
    ? (compiled.enabledBuiltinTools as string[])
    : undefined;
  const base = wizard
    ? summarizeWizardRuntime(wizard, mode)
    : {
        bookingMode: "UNKNOWN",
        bookingToolsExpected: [],
        transferEnabled: false,
        transferToolsExpected: [],
        voiceId: config.voice?.voiceId || "unknown",
        configFingerprint: fingerprintValue(config),
        capabilities: [],
        publishedMode: mode,
      };
  return { ...base, enabledTools };
}
