export type VoiceV3IntakeTransport = "function_tool" | "output_text";

/** Production: Astra capability function tools. output_text is test-only legacy. */
export function resolveVoiceV3IntakeTransport(): VoiceV3IntakeTransport {
  const raw = process.env.VOICE_V3_INTAKE_TRANSPORT?.trim().toLowerCase();
  if (raw === "output_text" || raw === "text") return "output_text";
  return "function_tool";
}
