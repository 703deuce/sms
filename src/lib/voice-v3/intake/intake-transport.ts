export type VoiceV3IntakeTransport = "function_tool" | "output_text";

/** Primary: strict emit_caller_meaning. Fallback: output_text JSON (fail-closed Zod). */
export function resolveVoiceV3IntakeTransport(): VoiceV3IntakeTransport {
  const raw = process.env.VOICE_V3_INTAKE_TRANSPORT?.trim().toLowerCase();
  if (raw === "output_text" || raw === "text") return "output_text";
  return "function_tool";
}
