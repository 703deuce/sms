import "server-only";

import { activateDueScheduledCampaigns } from "@/lib/messaging/dispatch/activate-scheduled-campaigns";
import { enqueueDueCampaignMessages } from "@/lib/campaigns/campaign-processor";
import { reclaimStuckSendingMessages } from "@/lib/campaigns/campaign-message-send";

export type SchedulerCycleResult = {
  campaignsActivated: number;
  messagesEnqueued: number;
  messagesSkippedAlreadyQueued: number;
  waitsAdvanced: number;
  reservationsReleased: number;
  deliveriesReconciled: number;
};

/** Release expired mass-texting credit reservations. */
export async function sweepExpiredCreditReservations(): Promise<number> {
  const prisma = (await import("@/lib/db")).getPrisma();
  const now = new Date();
  const expired = await prisma.massTextingCreditReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    take: 50,
    select: { id: true, campaignId: true },
  });

  if (!expired.length) return 0;

  const { releaseReservation } = await import("@/lib/mass-texting/credit-accounting");
  let released = 0;
  for (const row of expired) {
    await releaseReservation(row.id, "reservation_expired");
    released += 1;
  }
  return released;
}

/** Run one SMS scheduler cycle: recover, activate, advance sequences, enqueue sends. */
export async function runSmsSchedulerCycle(workspaceId?: string): Promise<SchedulerCycleResult> {
  await reclaimStuckSendingMessages();

  const campaignsActivated = await activateDueScheduledCampaigns(workspaceId);
  const dispatch = await enqueueDueCampaignMessages(workspaceId);
  const waits = dispatch.waits;

  let deliveriesReconciled = 0;
  if (!workspaceId && shouldRunDeliveryReconciliation()) {
    try {
      const { reconcilePendingDeliveryStatuses } = await import(
        "@/lib/messaging/delivery-reconciliation"
      );
      const result = await reconcilePendingDeliveryStatuses({ limit: 40, staleMinutes: 15 });
      deliveriesReconciled = result.reconciled;
    } catch (err) {
      console.warn("[sms-scheduler] delivery reconciliation failed", err);
    }
  }

  const reservationsReleased = workspaceId ? 0 : await sweepExpiredCreditReservations();

  return {
    campaignsActivated,
    messagesEnqueued: dispatch.enqueued,
    messagesSkippedAlreadyQueued: dispatch.skippedAlreadyQueued,
    waitsAdvanced: waits.advanced,
    reservationsReleased,
    deliveriesReconciled,
  };
}

let lastReconcileMs = 0;
function shouldRunDeliveryReconciliation(): boolean {
  const interval = Number(process.env.SMS_DELIVERY_RECONCILE_MS || 60_000);
  const now = Date.now();
  if (now - lastReconcileMs < interval) return false;
  lastReconcileMs = now;
  return true;
}
