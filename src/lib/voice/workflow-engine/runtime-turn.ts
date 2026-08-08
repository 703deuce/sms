/**
 * Caller Amy — single runtime gateway.
 * LLM submits caller meaning; realtime session controller owns fast routing.
 */

import { executeRealtimeSessionTurn } from "@/lib/voice/realtime-session/controller";
import type { RuntimeTurnInput } from "./runtime-turn-types";

export type { RuntimeTurnInput } from "./runtime-turn-types";

export async function executeAmyRuntimeTurn(
  input: RuntimeTurnInput,
): Promise<Record<string, unknown>> {
  if (!input.agentId) {
    const { executeAmyRuntimeTurnLegacy } = await import("./runtime-turn-legacy");
    return executeAmyRuntimeTurnLegacy(input);
  }
  return executeRealtimeSessionTurn(input);
}
