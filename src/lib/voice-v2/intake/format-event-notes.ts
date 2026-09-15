import "server-only";

import type { VoiceV2IntakeSchema, VoiceV2IntakeState } from "./types";

export function formatIntakeEventNotes(
  schema: VoiceV2IntakeSchema,
  state: VoiceV2IntakeState,
): string {
  const lines: string[] = ["Customer Information"];
  for (const field of schema.fields) {
    const val = state[field.key]?.value?.trim();
    if (!val) continue;
    lines.push(`${field.label}: ${val}`);
  }
  if (lines.length === 1) return "";
  return lines.join("\n");
}
