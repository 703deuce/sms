import type { AnswerClassification } from "./types";

/** Raw Telnyx premium AMD result strings (documented). */
export const TELNYX_PREMIUM_AMD_RESULTS = [
  "human",
  "human_residence",
  "human_business",
  "machine",
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
  "fax_detected",
  "silence",
  "not_sure",
] as const;

const MACHINE_GREETING_RESULTS = new Set([
  "machine_end_beep",
  "machine_end_silence",
  "machine_end_other",
]);

const HUMAN_RESULTS = new Set(["human", "human_residence", "human_business"]);
const UNCERTAIN_RESULTS = new Set(["not_sure", "silence", ""]);

/**
 * Authoritative mapping from Telnyx AMD / screening webhook `result` to normalized classification.
 * Does not use substring heuristics for screener — use mapTelnyxScreeningDetected for `result=screening`.
 */
export function mapTelnyxAmdResult(raw: string): AnswerClassification {
  const r = raw.toLowerCase().trim();
  if (!r) return "uncertain";
  if (r === "fax_detected" || r === "fax") return "fax";
  if (r === "machine") return "machine";
  if (MACHINE_GREETING_RESULTS.has(r)) return "voicemail";
  if (HUMAN_RESULTS.has(r)) return "human";
  if (UNCERTAIN_RESULTS.has(r)) return "uncertain";
  if (r.includes("machine")) return "voicemail";
  if (r.includes("human")) return "human";
  return "uncertain";
}

/** Telnyx `call.machine.premium.call_screening.detected` with result=screening */
export function mapTelnyxScreeningDetected(raw: string): AnswerClassification {
  const r = raw.toLowerCase().trim();
  if (r === "screening") return "screener";
  return "uncertain";
}

export function isConfirmedHumanClassification(
  classification: AnswerClassification | string | null | undefined,
): boolean {
  return classification === "human";
}

export function isMachineLikeClassification(
  classification: AnswerClassification | string | null | undefined,
): boolean {
  return (
    classification === "voicemail" ||
    classification === "machine" ||
    classification === "ivr" ||
    classification === "fax"
  );
}

export function classificationBlocksParallelWinner(
  classification: AnswerClassification | string | null | undefined,
  amdFilterMachines: boolean,
  uncertainPolicy: "offer" | "exclude" = "exclude",
): boolean {
  if (!amdFilterMachines) {
    return classification === "screener";
  }
  if (isMachineLikeClassification(classification) || classification === "screener") {
    return true;
  }
  if (classification === "uncertain" && uncertainPolicy === "exclude") {
    return true;
  }
  return false;
}
