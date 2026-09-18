import type { VoiceV3CallContext } from "../call-context/types";
import { getVoiceV3IntakeReadiness } from "./readiness";

/** Compact silent context for session.thinking.append (not spoken to caller). */
export function buildVoiceV3IntakeThinkingSnapshot(ctx: VoiceV3CallContext): string {
  const readiness = getVoiceV3IntakeReadiness(ctx.business, ctx.intakeState);
  const captured = Object.entries(ctx.intakeState)
    .map(([key, row]) => `${key}=${JSON.stringify(row.value)}`)
    .join("; ");

  return [
    "Authoritative intake state (application-owned; overrides assumptions).",
    `extraction_generation=${ctx.generations.extraction}`,
    `tool_generation=${ctx.generations.tool}`,
    `captured: ${captured || "(none)"}`,
    `missing_before_booking: ${readiness.missingBeforeBooking.join(", ") || "(none)"}`,
    `missing_for_record: ${readiness.missingForRecord.join(", ") || "(none)"}`,
  ].join("\n");
}

export function buildSessionThinkingAppendCommand(content: string): {
  type: "session.thinking.append";
  content: string;
  delegation_id: null;
} {
  return {
    type: "session.thinking.append",
    content,
    delegation_id: null,
  };
}
