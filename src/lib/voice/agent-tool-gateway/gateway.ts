import type { AgentToolContext } from "./types";
import { AgentToolError, failResult, translateError } from "./errors";
import { toLegacyVoiceShape } from "./envelope";
import { normalizeBookInput } from "./normalize";
import { runBookAppointment } from "./booking-workflow";
import { runCheckAvailabilityTool } from "./availability-workflow";

/** Canonical agent tool names + legacy aliases. */
const TOOL_ALIASES: Record<string, string> = {
  check_availability: "calendar_availability",
  calendar_availability: "calendar_availability",
  book_appointment: "book_appointment",
};

export async function executeAgentTool(input: {
  toolType: string;
  context: AgentToolContext;
  raw: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const canonical = TOOL_ALIASES[input.toolType] || input.toolType;
  const ctx = input.context;

  try {
    switch (canonical) {
      case "calendar_availability": {
        const result = await runCheckAvailabilityTool(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      case "book_appointment": {
        const result = await runBookAppointment(ctx, input.raw);
        return toLegacyVoiceShape(result);
      }
      default:
        throw new AgentToolError(
          "INVALID_INPUT",
          `Tool ${input.toolType} is not routed through the agent gateway yet`,
        );
    }
  } catch (err) {
    const ate = err instanceof AgentToolError ? err : translateError(err);
    const operationId =
      normalizeBookInput(input.raw, { callId: ctx.callId }).operation_id || null;
    return toLegacyVoiceShape(failResult(ate, operationId));
  }
}

export function isGatewayRoutedTool(toolType: string): boolean {
  const canonical = TOOL_ALIASES[toolType] || toolType;
  return canonical === "calendar_availability" || canonical === "book_appointment";
}
