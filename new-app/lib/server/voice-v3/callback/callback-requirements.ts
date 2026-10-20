import type { VoiceV3AgentConfig } from "../types/agent-config";

const DEFAULT_REASON_KEYS = ["service_reason", "service", "notes", "reason"] as const;

/** Prompt-only subset — full runtime validation lives in the voice worker. */
export function resolveConfiguredCallbackRequiredKeys(
  config: VoiceV3AgentConfig,
): string[] {
  const keys = new Set(config.intakeFields.map((f) => f.key));
  const required: string[] = [];
  if (keys.has("name")) required.push("name");
  if (keys.has("phone")) required.push("phone");
  const reasonKey = DEFAULT_REASON_KEYS.find((k) => keys.has(k));
  if (reasonKey) required.push(reasonKey);
  else required.push("service_reason");
  return required;
}
