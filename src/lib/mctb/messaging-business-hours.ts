import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import { inMctbBusinessWindow } from "@/lib/mctb/message-template";
import {
  deriveWeeklyFromConfig,
  isNowInWeeklySchedule,
  type MctbWeeklySchedule,
} from "@/lib/mctb/schedule-shared";

/** Whether the business is "open" for MCTB messaging copy (not send-window / pause). */
export function resolveMctbMessagingInBusinessHoursFromSchedule(
  config: MissedCallTextConfigRecord,
  weeklySchedule: MctbWeeklySchedule | null | undefined,
  now = new Date(),
): boolean {
  const weekly = weeklySchedule ?? deriveWeeklyFromConfig(config);
  if (weekly?.days?.length) {
    return isNowInWeeklySchedule(now, weekly);
  }
  return inMctbBusinessWindow(config, now);
}
