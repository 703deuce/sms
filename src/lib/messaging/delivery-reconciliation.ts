/**
 * Reconcile outbound messages stuck without a terminal delivery status.
 * Recovery path: provider API lookup → DB update (not UI polling).
 */

import { getPrisma } from "@/lib/db";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { applyOutboundDeliveryStatus } from "@/lib/messaging/delivery-status";

const TERMINAL = new Set(["delivered", "failed", "undelivered", "expired", "clicked"]);

export type ReconcileResult = {
  scanned: number;
  reconciled: number;
  skipped: number;
  errors: number;
};

export async function reconcilePendingDeliveryStatuses(options?: {
  workspaceId?: string;
  staleMinutes?: number;
  limit?: number;
}): Promise<ReconcileResult> {
  const prisma = getPrisma();
  const staleMinutes = options?.staleMinutes ?? 30;
  const limit = options?.limit ?? 100;
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

  const pending = await prisma.campaignMessage.findMany({
    where: {
      ...(options?.workspaceId ? { workspaceId: options.workspaceId } : {}),
      providerId: { not: null },
      status: { in: ["sent", "sending", "queued"] },
      sentAt: { lt: cutoff },
      NOT: { providerId: { startsWith: "pending:" } },
    },
    orderBy: { sentAt: "asc" },
    take: limit,
    select: {
      id: true,
      providerId: true,
      workspaceId: true,
      status: true,
    },
  });

  const result: ReconcileResult = { scanned: pending.length, reconciled: 0, skipped: 0, errors: 0 };
  if (!pending.length) return result;

  const provider = getMessagingProvider();

  for (const msg of pending) {
    const sid = msg.providerId;
    if (!sid || sid.startsWith("pending:") || sid.startsWith("idem:")) {
      result.skipped += 1;
      continue;
    }

    try {
      const lookup = await lookupProviderMessageStatus(provider.name, sid, msg.workspaceId);
      if (!lookup) {
        result.skipped += 1;
        continue;
      }
      if (TERMINAL.has(lookup.status)) {
        await applyOutboundDeliveryStatus({
          providerMessageId: sid,
          status: lookup.status,
          providerStatus: lookup.providerStatus,
          errorCode: lookup.errorCode,
          errorDetail: lookup.errorDetail,
          provider: provider.name === "twilio" ? "twilio" : provider.name === "telnyx" ? "telnyx" : null,
        });
        result.reconciled += 1;
      } else {
        result.skipped += 1;
      }
    } catch (err) {
      console.warn("[delivery-reconciliation] failed", msg.id, err);
      result.errors += 1;
    }
  }

  return result;
}

async function lookupProviderMessageStatus(
  providerName: string,
  providerMessageId: string,
  workspaceId: string,
): Promise<{
  status: string;
  providerStatus: string;
  errorCode?: string | null;
  errorDetail?: string | null;
} | null> {
  if (providerName === "twilio") {
    const prisma = getPrisma();
    const reg = await prisma.messagingRegistration.findFirst({
      where: { workspaceId },
      select: { subaccountSid: true, subaccountAuthTokenEnc: true },
    });
    if (!reg?.subaccountSid || !reg.subaccountAuthTokenEnc) return null;
    const { decryptSecret } = await import("@/lib/messaging/crypto");
    const { getSubaccountTwilioClient } = await import("@/lib/messaging/twilio-client");
    const client = getSubaccountTwilioClient(
      reg.subaccountSid,
      decryptSecret(reg.subaccountAuthTokenEnc),
    );
    const message = await client.messages(providerMessageId).fetch();
    const status = (message.status || "unknown").toLowerCase();
    return {
      status,
      providerStatus: message.status || "unknown",
      errorCode: message.errorCode != null ? String(message.errorCode) : null,
      errorDetail: message.errorMessage || null,
    };
  }

  if (providerName === "telnyx") {
    const { lookupTelnyxMessageStatus } = await import("@/lib/messaging/telnyx/lookup-message-status");
    return lookupTelnyxMessageStatus(providerMessageId);
  }

  return null;
}
