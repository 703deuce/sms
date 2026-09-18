import type { VoiceV3CallContext } from "../state/call-context";

/** Drop availability/scheduling interpretations from a superseded search generation. */
export function isStaleSchedulingPreference(
  ctx: VoiceV3CallContext,
  resultSchedulingGeneration: number,
): boolean {
  return resultSchedulingGeneration < ctx.scheduling.generation;
}
