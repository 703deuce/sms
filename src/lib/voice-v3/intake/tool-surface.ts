import { resolveVoiceV3IntakeTransport } from "./intake-transport";

export type VoiceV3DelegationToolSurface = "capability_tools" | "emit_caller_meaning" | "output_text";

/** Production default: typed capability tools (update_intake, find_availability, book_appointment, …). */
export function resolveVoiceV3DelegationToolSurface(): VoiceV3DelegationToolSurface {
  const transport = resolveVoiceV3IntakeTransport();
  if (transport === "output_text") return "output_text";
  const legacy = process.env.VOICE_V3_LEGACY_EMIT_CALLER_MEANING?.trim().toLowerCase();
  if (legacy === "1" || legacy === "true" || legacy === "yes") {
    return "emit_caller_meaning";
  }
  return "capability_tools";
}

export function voiceV3UsesCapabilityTools(): boolean {
  return resolveVoiceV3DelegationToolSurface() === "capability_tools";
}
