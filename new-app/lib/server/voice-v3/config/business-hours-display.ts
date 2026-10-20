import type { VoiceV2BusinessScheduleConfig } from "@/lib/voice-receptionist-wizard/operating-maturity/types";
import { formatWeeklyHoursForAmy } from "./business-hours-from-wizard";

export type BusinessHoursAmyCompileResult = {
  /** Caller-facing hours text for Amy hot context — authoritative when structured schedule exists. */
  hoursDisplay: string | undefined;
  /** Free-form hours knowledge prose (never used for FIND/BOOK). */
  hoursKnowledgeProse?: string;
  /** True when prose differs from structured display (scheduling still uses structured only). */
  hoursProseConflictsWithStructured: boolean;
};

function normalizeHoursText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Structured weekly schedule is scheduling authority; prose hours are conversational only.
 */
export function compileBusinessHoursAmyDisplay(input: {
  structuredSchedule: VoiceV2BusinessScheduleConfig | null | undefined;
  hoursKnowledgeProse?: string | null;
}): BusinessHoursAmyCompileResult {
  const structuredDisplay = formatWeeklyHoursForAmy(input.structuredSchedule ?? null);
  const prose = input.hoursKnowledgeProse?.trim() || undefined;

  if (structuredDisplay) {
    const conflicts =
      Boolean(prose) &&
      normalizeHoursText(prose) !== normalizeHoursText(structuredDisplay);
    return {
      hoursDisplay: structuredDisplay,
      hoursKnowledgeProse: prose,
      hoursProseConflictsWithStructured: conflicts,
    };
  }

  return {
    hoursDisplay: prose,
    hoursKnowledgeProse: prose,
    hoursProseConflictsWithStructured: false,
  };
}
