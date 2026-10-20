import { resolveVoiceV3IntakeTransport } from "./intake-transport";

export type VoiceV3DelegationToolSurface = "capability_tools" | "output_text";

/** Production: typed Astra capability tools on Responses delegation. */
export function resolveVoiceV3DelegationToolSurface(): VoiceV3DelegationToolSurface {
  const transport = resolveVoiceV3IntakeTransport();
  return transport === "output_text" ? "output_text" : "capability_tools";
}

export function voiceV3UsesCapabilityTools(): boolean {
  return resolveVoiceV3DelegationToolSurface() === "capability_tools";
}
