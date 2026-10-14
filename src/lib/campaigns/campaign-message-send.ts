import { getPrisma } from "@/lib/db";
import { checkCreditBalance } from "@/lib/billing/entitlements";
import { deductCreditsForSend } from "@/lib/settings/billing";
import { assertWithinWorkspaceLimits } from "@/lib/settings/limits";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { sendViaRegistration } from "@/lib/messaging/registration-processor";
import { isMessagingReady } from "@/lib/messaging/status";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { tryAdvanceRecipientAfterSend } from "./sequence-runner";
import { parseSequence } from "./sequence-engine";
import { isPhoneCampaignChannel, mediaUrlsForSequenceStep } from "@/lib/mass-texting/mms";

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
    await tryAdvanceRecipientAfterSend(message.recipientId, message.stepKey);
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

function mediaUrlsForQueuedMessage(message: {
  channel: string;
  stepKey: string | null;
  campaign: { configJson: unknown; sequenceJson: unknown };
}): string[] | undefined {
  if (message.channel !== "mms") return undefined;
  const sequence = parseSequence(message.campaign.sequenceJson);
  const step = sequence.find((s) => s.step_key === message.stepKey) || null;
  const urls = mediaUrlsForSequenceStep(step, message.campaign.configJson, sequence);
  return urls.length ? urls : undefined;
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

  const { isMassTextingCampaign } = await import("@/lib/mass-texting/campaign-send");
  const massTextCampaign = await isMassTextingCampaign(
    message.workspaceId,
    message.campaignId,
  );

  if (!massTextCampaign) {
    const entitlement = await checkCreditBalance(message.workspaceId);
    if (!entitlement.ok) {
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "failed", error: entitlement.error },
      });
      await failRecipient(message.recipientId, entitlement.error);
      throw new JobFailedError(entitlement.error);
    }
  } else {
    const { assertMassTextMarketingSendAllowed } = await import(
      "@/lib/mass-texting/a2p-enforcement"
    );
    const { getSegmentAvailability } = await import("@/lib/mass-texting/credit-accounting");
    const a2pGate = await assertMassTextMarketingSendAllowed(message.workspaceId);
    if (!a2pGate.allowed) {
      const reason = a2pGate.reason || "Mass Texting A2P not ready";
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "failed", error: reason },
      });
      await failRecipient(message.recipientId, reason);
      throw new JobFailedError(reason);
    }
    const availability = await getSegmentAvailability(message.workspaceId);
    const { getActiveCampaignReservation } = await import(
      "@/lib/mass-texting/credit-accounting"
    );
    const reservation = await getActiveCampaignReservation(message.campaignId);
    if (!availability.accountSendEligible) {
      const reason = availability.blockReason || "Mass Texting sending is not eligible";
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "failed", error: reason },
      });
      await failRecipient(message.recipientId, reason);
      throw new JobFailedError(reason);
    }
    if (!reservation && !availability.canSend) {
      const reason = availability.blockReason || "Insufficient Mass Texting segments";
      await prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: "failed", error: reason },
      });
      await failRecipient(message.recipientId, reason);
      throw new JobFailedError(reason);
    }
  }

  try {
    await assertWithinWorkspaceLimits(message.workspaceId);
  } catch (limitErr) {
    const reason = limitErr instanceof Error ? limitErr.message : "workspace_limit";
    const tomorrow = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.campaignMessage.updateMany({
      where: { id: messageId, status: "sending" },
      data: { status: "queued", scheduledFor: tomorrow, error: reason },
    });
    throw new JobDeferredError(reason, 60 * 60_000);
  }

  if (isPhoneCampaignChannel(message.channel) && message.to) {
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
  if (isPhoneCampaignChannel(message.channel) && message.to) {
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
      if (massTextCampaign) {
        const { readBroadcastConfig } = await import("@/lib/mass-texting/broadcast/service");
        const { parseMassMessagingSenderMode, resolveSharedPlatformOutboundSender } = await import(
          "@/lib/messaging/platform-outbound-sender"
        );
        const { sendQuickSms } = await import("@/lib/sms/send-quick");
        const { touchPlatformProductConsumerAssignment } = await import(
          "@/lib/messaging/platform-product-consumer-assignment"
        );
        const broadcastConfig = readBroadcastConfig(message.campaign.configJson);
        const senderMode = parseMassMessagingSenderMode(broadcastConfig?.senderMode, "WORKSPACE");

        if (senderMode === "PLATFORM") {
          const platformRoute = await resolveSharedPlatformOutboundSender();
          if (!platformRoute?.fromE164) {
            throw new Error("Platform sender is not configured");
          }
          const quick = await sendQuickSms({
            workspaceId: message.workspaceId,
            to: message.to,
            body: message.body,
            campaignId: message.campaignId,
            mediaUrls: mediaUrlsForQueuedMessage(message),
            senderRoute: platformRoute,
            idempotencyKey: `campaign:${messageId}`,
          });
          providerAccepted = true;
          providerSid = quick.sid;

          try {
            const contact = await prisma.contact.findUnique({
              where: {
                workspaceId_phone: { workspaceId: message.workspaceId, phone: message.to },
              },
            });
            if (contact && platformRoute.phoneNumberId) {
              const { ensureProductConversation } = await import(
                "@/lib/mass-texting/conversation-context"
              );
              const conv = await ensureProductConversation({
                workspaceId: message.workspaceId,
                contactId: contact.id,
                productSource: "mass_text",
                phoneNumberId: platformRoute.phoneNumberId,
                fromE164: platformRoute.fromE164,
                campaignId: message.campaignId,
              });
              await touchPlatformProductConsumerAssignment({
                workspaceId: message.workspaceId,
                consumerE164: message.to,
                platformPhoneNumberId: platformRoute.phoneNumberId,
                product: "mass_text",
                conversationId: conv.conversationId,
              });
            }
          } catch {
            // conversation tagging is best-effort
          }
        } else {
          const { resolveMassTextSendingNumber } = await import(
            "@/lib/mass-texting/messaging-registration"
          );
          const sender = await resolveMassTextSendingNumber(
            message.workspaceId,
            broadcastConfig?.numberId,
          );
          if (!sender?.phoneE164) {
            throw new Error("Mass Texting sending number not configured");
          }
          const result = await sendViaRegistration(
            message.workspaceId,
            message.to,
            message.body,
            mediaUrlsForQueuedMessage(message),
            sender.phoneE164,
          );
          providerAccepted = true;
          providerSid = result.sid;

          try {
            const contact = await prisma.contact.findUnique({
              where: {
                workspaceId_phone: { workspaceId: message.workspaceId, phone: message.to },
              },
            });
            if (contact) {
              const { ensureProductConversation } = await import(
                "@/lib/mass-texting/conversation-context"
              );
              await ensureProductConversation({
                workspaceId: message.workspaceId,
                contactId: contact.id,
                productSource: "mass_text",
                phoneNumberId: sender.phoneNumberId,
                fromE164: sender.phoneE164,
                campaignId: message.campaignId,
              });
            }
          } catch {
            // conversation tagging is best-effort
          }
        }

        try {
          const { emitMassTextOpsEvent } = await import("@/lib/mass-texting/ops-events");
          await emitMassTextOpsEvent({
            workspaceId: message.workspaceId,
            eventType: "mass_text.campaign_message_sent",
            campaignId: message.campaignId,
            payload: { messageId, to: message.to, providerSid: result.sid },
          });
        } catch {
          // observability is best-effort
        }
      } else {
      const reg = await getRegistrationByWorkspace(message.workspaceId);
      if (!isMessagingReady(reg)) {
        throw new Error("Messaging not ready for workspace");
      }
      let fromOverride: string | undefined;
      if (message.campaign.senderPoolId) {
        const { resolvePoolSender } = await import("@/lib/numbers/sender-pool");
        fromOverride = await resolvePoolSender(message.workspaceId, message.campaign.senderPoolId);
      }
      const result = await sendViaRegistration(
        message.workspaceId,
        message.to,
        message.body,
        mediaUrlsForQueuedMessage(message),
        fromOverride,
      );
      providerAccepted = true;
      providerSid = result.sid;
      }
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

    if (isPhoneCampaignChannel(message.channel) && !massTextCampaign) {
      try {
        const { MASS_TEXT_MMS_CREDIT_MULTIPLIER } = await import("@/lib/mass-texting/pricing");
        await deductCreditsForSend(
          message.workspaceId,
          message.channel === "mms" ? MASS_TEXT_MMS_CREDIT_MULTIPLIER : 1,
          `Campaign ${message.channel.toUpperCase()} ${message.campaignId}`,
        );
      } catch (creditErr) {
        console.warn("[sendCampaignMessageById] credit deduction failed", messageId, creditErr);
      }
    }

    await finalizeSentMessage(messageId);
    if (massTextCampaign) {
      try {
        const { settleCampaignReservation } = await import(
          "@/lib/mass-texting/credit-accounting"
        );
        const { reconcileCampaignStatus } = await import("@/lib/campaigns/sequence-runner");
        await reconcileCampaignStatus(message.campaignId);
        const campaign = await prisma.campaign.findUnique({
          where: { id: message.campaignId },
          select: { status: true },
        });
        const activeRecipients = await prisma.campaignRecipient.count({
          where: {
            campaignId: message.campaignId,
            workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
          },
        });
        const open = await prisma.campaignMessage.count({
          where: {
            campaignId: message.campaignId,
            status: { in: ["queued", "sending"] },
          },
        });
        if (
          activeRecipients === 0 &&
          open === 0 &&
          campaign &&
          (campaign.status === "COMPLETED" || campaign.status === "FAILED" || campaign.status === "CANCELED")
        ) {
          await settleCampaignReservation(message.campaignId);
        }
      } catch {
        // settlement is best-effort
      }
    }
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

    const { classifySmsProviderError } = await import("@/lib/mass-texting/provider-errors");
    const prior = retryCountFromError(message.error);
    const next = prior + 1;
    const retryable = classifySmsProviderError(error) === "retryable";
    if (retryable && next < 3) {
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
