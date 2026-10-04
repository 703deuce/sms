import { getPrisma } from "@/lib/db";

const SCHEDULE_CLAIMABLE_STATUSES = ["ELIGIBILITY_CHECK", "DETECTED"] as const;

export type MctbScheduleClaimResult =
  | { claimed: true; alreadyScheduled: false }
  | { claimed: false; alreadyScheduled: true }
  | { claimed: false; alreadyScheduled: false; reason: "terminal" | "not_found" | "in_progress" };

/**
 * Single-writer gate for recovery SMS scheduling — only one path may enqueue john_mctb_send + inline send.
 */
export async function claimMctbRecoverySchedule(input: {
  workspaceId: string;
  missedCallEventId: string;
}): Promise<MctbScheduleClaimResult> {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: input.missedCallEventId, workspaceId: input.workspaceId },
    select: { id: true, status: true, scheduledSmsAt: true, smsSentAt: true },
  });
  if (!event) {
    return { claimed: false, alreadyScheduled: false, reason: "not_found" };
  }
  if (event.smsSentAt || event.scheduledSmsAt) {
    return { claimed: false, alreadyScheduled: true };
  }
  if (
    event.status === "SCHEDULED" ||
    event.status === "SENDING" ||
    event.status === "SENT"
  ) {
    return { claimed: false, alreadyScheduled: true };
  }
  if (event.status === "SUPPRESSED" || event.status === "FAILED") {
    return { claimed: false, alreadyScheduled: false, reason: "terminal" };
  }

  const claimed = await prisma.missedCallEvent.updateMany({
    where: {
      id: event.id,
      workspaceId: input.workspaceId,
      scheduledSmsAt: null,
      smsSentAt: null,
      status: { in: [...SCHEDULE_CLAIMABLE_STATUSES] },
    },
    data: { status: "SCHEDULED" },
  });
  if (claimed.count === 1) {
    return { claimed: true, alreadyScheduled: false };
  }

  const fresh = await prisma.missedCallEvent.findFirst({
    where: { id: event.id },
    select: { status: true, scheduledSmsAt: true, smsSentAt: true },
  });
  if (fresh?.smsSentAt || fresh?.scheduledSmsAt) {
    return { claimed: false, alreadyScheduled: true };
  }
  if (
    fresh?.status === "SCHEDULED" ||
    fresh?.status === "SENDING" ||
    fresh?.status === "SENT"
  ) {
    return { claimed: false, alreadyScheduled: true };
  }
  return { claimed: false, alreadyScheduled: false, reason: "in_progress" };
}
