/**
 * Voice V3 tool concurrency classification and dependency rules (Phase 7).
 */

export type VoiceToolKind = "state_update" | "read" | "mutation" | "lifecycle";

export const VOICE_TOOL_KIND_BY_NAME: Record<string, VoiceToolKind> = {
  update_intake: "state_update",
  set_scheduling_preference: "state_update",
  find_availability: "read",
  find_appointment: "read",
  book_appointment: "mutation",
  reschedule_appointment: "mutation",
  cancel_appointment: "mutation",
  transfer_call: "lifecycle",
  end_call: "lifecycle",
};

/**
 * Live Responses delegation: keep false until batch executor guarantees
 * N outputs → exactly one protocol response.create (Phase 7 / 8).
 */
export function voiceV3DelegationParallelToolCallsEnabled(): boolean {
  return process.env.VOICE_V3_PARALLEL_TOOL_CALLS === "1";
}

export function toolsMayRunInParallel(a: string, b: string): boolean {
  if (a === b) return false;
  const findSetPair =
    (a === "find_availability" && b === "set_scheduling_preference") ||
    (a === "set_scheduling_preference" && b === "find_availability");
  if (findSetPair) return false;
  const ka = VOICE_TOOL_KIND_BY_NAME[a];
  const kb = VOICE_TOOL_KIND_BY_NAME[b];
  if (!ka || !kb) return false;
  if (ka === "mutation" || kb === "mutation") return false;
  if (ka === "lifecycle" || kb === "lifecycle") return false;
  const readPair = (ka === "read" || ka === "state_update") && (kb === "read" || kb === "state_update");
  return readPair;
}
