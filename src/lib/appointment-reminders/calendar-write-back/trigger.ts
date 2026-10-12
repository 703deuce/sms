import "server-only";

import { enqueueArCalendarWriteBack } from "./enqueue";
import type { ArCalendarWriteBackKind } from "./types";

/** Queue durable calendar write-back after a committed appointment response transition. */
export async function triggerArCalendarWriteBack(input: {
  workspaceId: string;
  appointmentId: string;
  kind: ArCalendarWriteBackKind;
  atIso?: string;
  previousStartsAtIso?: string;
  previousEndsAtIso?: string;
  newStartsAtIso?: string;
  newEndsAtIso?: string;
}): Promise<void> {
  await enqueueArCalendarWriteBack(input).catch((err) => {
    console.warn("[ar-calendar-write-back] enqueue failed", input.appointmentId, input.kind, err);
  });
}
