/**
 * Softphone call-path event log — support diagnostics for "why didn't it ring?"
 */

import { getPrisma } from "@/lib/db";

export async function logHumanCallEvent(
  workspaceId: string,
  humanCallId: string,
  eventType: string,
  payload?: Record<string, unknown>,
) {
  try {
    await getPrisma().humanCallEvent.create({
      data: {
        workspaceId,
        humanCallId,
        eventType,
        payload: (payload || {}) as object,
      },
    });
  } catch (err) {
    console.warn("[human-call-event]", eventType, humanCallId, err);
  }
}

export async function listHumanCallEvents(workspaceId: string, humanCallId: string) {
  return getPrisma().humanCallEvent.findMany({
    where: { workspaceId, humanCallId },
    orderBy: { createdAt: "asc" },
  });
}
