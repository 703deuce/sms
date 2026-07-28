import { getPrisma } from "@/lib/db";
import { requireCampaignSendAccess } from "@/lib/billing/entitlements";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { tryAdvanceRecipientAfterSend } from "./sequence-runner";

const ACTIVE_RECIPIENT = ["pending", "scheduled", "in_progress", "waiting"] as const;

async function claimMessage(id: string) {
  const result = await getPrisma().campaignMessage.updateMany({
    where: { id, status: "queued" },
    data: { status: "sending" },
  });
  return result.count === 1;
}

async function failRecipient(recipientId: string, reason: string) {
  await getPrisma().campaignRecipient.updateMany({
    where: {
      id: recipientId,
      workflowStatus: { in: [...ACTIVE_RECIPIENT] },
    },
    data: {
      workflowStatus: "failed",
      stopReason: reason,
      completedAt: new Date(),
      enrollmentKey: null,
      nextActionAt: null,
    },
  });
}

/** Idempotent post-send bookkeeping: count once + advance (CAS-safe). */
export async function finalizeSentMessage(messageId: string) {
  const prisma = getPrisma();
  const message = await prisma.campaignMessage.findUnique({ where: { id: messageId } });
  if (!message) return { ok: false as const, reason: "missing" };
  if (!["sent", "delivered", "clicked"].includes(message.status)) {
    return { ok: false as const, reason: "not_sent" };
  }

  const counted = await prisma.campaignMessage.updateMany({
    where: { id: messageId, sentCounted: false },
    data: { sentCounted: true },
  });
  if (counted.count === 1) {
    await prisma.campaign.update({
      where: { id: message.campaignId },
      data: { sent: { increment: 1 } },
    });
  }

  // Advancement is idempotent via currentStep CAS — always attempt so crashes recover
  try {
    await tryAdvanceRecipientAfterSend(message.recipientId);
    await prisma.campaignMessage.updateMany({
      where: { id: messageId, advancedAfterSend: false },
      data: { advancedAfterSend: true },
    });
  } catch (err) {
    console.warn("[finalizeSentMessage] advance failed", messageId, err);
  }
  return { ok: true as const, counted: counted.count === 1 };
}

/**
 * Reclaim stuck sends without double-sending:
 * - no providerId yet → crash before provider call → safe to requeue
 * - pending:* → provider outcome unknown → assume sent (never resend) and finalize
 */
export async function reclaimStuckSendingMessages(staleMs = 10 * 60 * 1000) {
  const prisma = getPrisma();
  const cutoff = new Date(Date.now() - staleMs);

  await prisma.campaignMessage.updateMany({
    where: {
      status: "sending",
      updatedAt: { lt: cutoff },
      providerId: null,
    },
    data: { status: "queued", error: "reclaimed_stale_sending" },
  });

  const assumed = await prisma.campaignMessage.findMany({
    where: {
      status: "sending",
      updatedAt: { lt: cutoff },
      providerId: { startsWith: "pending:" },
    },
    take: 50,
  });

  for (const msg of assumed) {
    const marked = await prisma.campaignMessage.updateMany({
      where: { id: msg.id, status: "sending", providerId: { startsWith: "pending:" } },
      data: {
        status: "sent",
        sentAt: msg.sentAt || new Date(),
        error: "assumed_sent_after_crash",
      },
    });
    if (marked.count !== 1) continue;
    await finalizeSentMessage(msg.id);
  }

  // Recover sent rows that never finished bookkeeping or advancement
  const unfinished = await prisma.campaignMessage.findMany({
    where: {
      status: { in: ["sent", "delivered", "clicked"] },
      OR: [{ sentCounted: false }, { advancedAfterSend: false }],
    },
    take: 50,
  });
  for (const msg of unfinished) {
    await finalizeSentMessage(msg.id);
  }
}

function inSendWindow(now: Date, startHour: number | null | undefined, endHour: number | null | undefined) {
  if (startHour == null || endHour == null) return true;
  const hour = now.getUTCHours();
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function retryCountFromError(error: string | null | undefined) {
  const match = (error || "").match(/retry:(\d+):/);
  return match ? Number(match[1]) : 0;
}

export async function sendCampaignMessageById(messageId: string) {
  const prisma = getPrisma();
  await reclaimStuckSendingMessages();

  const message = await prisma.campaignMessage.findUnique({
    where: { id: messageId },
    include: { recipient: true, campaign: true },
  });
  if (!message) throw new Error(`Campaign message ${messageId} not found`);

  if (message.status === "failed") {
    await failRecipient(message.recipientId, message.error || "send_failed");
    throw new JobFailedError(message.error || "send_failed");
  }

  // Already sent — finish bookkeeping if needed, never resend
  if (["sent", "delivered", "clicked"].includes(message.status)) {
    await finalizeSentMessage(messageId);
    return { skipped: true, status: message.status, finalized: true };
  }

  if (message.status !== "queued") {
    return { skipped: true, status: message.status };
  }

  if (!ACTIVE_RECIPIENT.includes(message.recipient.workflowStatus as (typeof ACTIVE_RECIPIENT)[number])) {
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "skipped", error: `recipient_${message.recipient.workflowStatus}` },
    });
    return { skipped: true, status: "recipient_terminal" };
  }

  if (message.campaign.status !== "SENDING") {
    if (message.campaign.status === "SCHEDULED") {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          scheduledFor: message.campaign.scheduledAt || new Date(),
          error: "waiting_for_schedule",
        },
      });
      return { deferred: true, reason: "scheduled" };
    }
    return { deferred: true, reason: "campaign_not_active" };
  }

  const now = new Date();
  if (!inSendWindow(now, message.campaign.sendWindowStart, message.campaign.sendWindowEnd)) {
    const next = new Date(now.getTime() + 60 * 60 * 1000);
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { scheduledFor: next, error: "outside_send_window" },
    });
    return { deferred: true, reason: "send_window" };
  }

  if (message.campaign.dailySendLimit != null) {
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sentToday = await prisma.campaignMessage.count({
      where: {
        campaignId: message.campaignId,
        OR: [
          { status: { in: ["sent", "delivered", "clicked"] }, sentAt: { gte: dayStart } },
          { status: "sending", updatedAt: { gte: dayStart } },
        ],
        id: { not: messageId },
      },
    });
    if (sentToday >= message.campaign.dailySendLimit) {
      const tomorrow = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { scheduledFor: tomorrow, error: "daily_limit" },
      });
      return { deferred: true, reason: "daily_limit" };
    }
  }

  const claimed = await claimMessage(messageId);
  if (!claimed) return { skipped: true, status: "race" };

  const entitlement = requireCampaignSendAccess(message.workspaceId);
  if (!entitlement.ok) {
    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "failed", error: entitlement.error },
    });
    await failRecipient(message.recipientId, entitlement.error);
    throw new JobFailedError(entitlement.error);
  }

  if (message.channel === "sms" && message.to) {
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId: message.workspaceId, phone: message.to } },
    });
    if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "opted_out", error: `contact_${contact.status.toLowerCase()}` },
      });
      await prisma.campaignRecipient.updateMany({
        where: { id: message.recipientId, workflowStatus: { in: [...ACTIVE_RECIPIENT] } },
        data: {
          workflowStatus: "opted_out",
          stopReason: contact.status,
          completedAt: new Date(),
          enrollmentKey: null,
          nextActionAt: null,
        },
      });
      return { optedOut: true };
    }

    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: message.workspaceId, phone: message.to },
    });
    if (suppressed) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "opted_out", error: "suppressed" },
      });
      await prisma.campaignRecipient.updateMany({
        where: { id: message.recipientId, workflowStatus: { in: [...ACTIVE_RECIPIENT] } },
        data: {
          workflowStatus: "opted_out",
          stopReason: "suppression",
          completedAt: new Date(),
          enrollmentKey: null,
          nextActionAt: null,
        },
      });
      await prisma.campaignMessage.updateMany({
        where: { recipientId: message.recipientId, status: "queued" },
        data: { status: "skipped", error: "stopped: opted_out" },
      });
      return { optedOut: true };
    }
  }

  if (message.channel === "email" && message.to) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId: message.workspaceId, email: message.to.toLowerCase() },
    });
    if (suppressed) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "opted_out", error: "suppressed" },
      });
      await prisma.campaignRecipient.updateMany({
        where: { id: message.recipientId, workflowStatus: { in: [...ACTIVE_RECIPIENT] } },
        data: {
          workflowStatus: "opted_out",
          stopReason: "suppression",
          completedAt: new Date(),
          enrollmentKey: null,
          nextActionAt: null,
        },
      });
      return { optedOut: true };
    }
  }

  // Final pre-provider gate: STOP may have raced after claim
  const preflight = await prisma.campaignMessage.findUnique({
    where: { id: messageId },
    include: { recipient: true },
  });
  if (!preflight || preflight.status !== "sending") {
    return { skipped: true, status: preflight?.status || "missing" };
  }
  if (!ACTIVE_RECIPIENT.includes(preflight.recipient.workflowStatus as (typeof ACTIVE_RECIPIENT)[number])) {
    await prisma.campaignMessage.updateMany({
      where: { id: messageId, status: "sending" },
      data: { status: "skipped", error: `recipient_${preflight.recipient.workflowStatus}` },
    });
    return { skipped: true, status: "recipient_terminal" };
  }
  if (message.channel === "sms" && message.to) {
    const lateSuppressed = await prisma.suppression.findFirst({
      where: { workspaceId: message.workspaceId, phone: message.to },
    });
    if (lateSuppressed) {
      await prisma.campaignMessage.updateMany({
        where: { id: messageId, status: "sending" },
        data: { status: "opted_out", error: "suppressed_late", providerId: null },
      });
      return { optedOut: true };
    }
  }

  await prisma.campaignMessage.update({
    where: { id: messageId },
    data: { providerId: `pending:${messageId}` },
  });

  let providerAccepted = false;
  let providerSid: string | null = null;

  try {
    if (message.channel === "email") {
      const result = await sendTransactionalEmail({
        to: message.to,
        subject: message.campaign.name || "Message",
        htmlContent: `<p>${escapeHtml(message.body).replace(/\n/g, "<br/>")}</p>`,
        textContent: message.body,
      });
      if (result.status === "failed") {
        throw new Error(result.error || "Email send failed");
      }
      if (
        result.provider === "stub" &&
        (process.env.TWILIO_MODE === "live" || process.env.MESSAGING_ADAPTER === "twilio") &&
        process.env.ALLOW_EMAIL_STUB !== "1"
      ) {
        throw new Error("BREVO_API_KEY is required to send campaign email in live mode");
      }
      providerAccepted = true;
      providerSid = result.id;
    } else {
      const reg = await getRegistrationByWorkspace(message.workspaceId);
      if (!isMessagingReady(reg)) {
        throw new Error("Messaging not ready for workspace");
      }
      const result = await sendViaRegistration(message.workspaceId, message.to, message.body);
      providerAccepted = true;
      providerSid = result.sid;
    }

    await prisma.campaignMessage.updateMany({
      where: { id: messageId, status: "sending" },
      data: {
        status: "sent",
        sentAt: new Date(),
        providerId: providerSid,
        error: null,
      },
    });

    await finalizeSentMessage(messageId);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    if (providerAccepted) {
      await prisma.campaignMessage.updateMany({
        where: { id: messageId, status: { in: ["sending", "queued"] } },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerId: providerSid || `pending:${messageId}`,
          error: `bookkeeping_error:${error}`,
        },
      });
      await finalizeSentMessage(messageId);
      return { ok: true, bookkeepingError: error };
    }

    // Ambiguous transport error after provisional mark — do not clear and resend.
    // Leave sending+pending so reclaim can assume-sent rather than double-send.
    const looksAmbiguous =
      /timeout|ECONNRESET|socket|network|aborted|ETIMEDOUT/i.test(error);
    if (looksAmbiguous) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { error: `ambiguous_send:${error}` },
      });
      throw new JobDeferredError(`send_ambiguous:${error}`, 5 * 60_000);
    }

    const prior = retryCountFromError(message.error);
    const next = prior + 1;
    if (next < 3) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: "queued",
          providerId: null,
          scheduledFor: new Date(Date.now() + next * 60_000),
          error: `retry:${next}:${error}`,
        },
      });
      throw new JobDeferredError(`send_retry:${next}:${error}`, next * 60_000);
    }

    await prisma.campaignMessage.update({
      where: { id: messageId },
      data: { status: "failed", providerId: null, error },
    });
    await failRecipient(message.recipientId, error);
    throw new JobFailedError(error);
  }
}
