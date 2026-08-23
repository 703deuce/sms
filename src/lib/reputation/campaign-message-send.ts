/**
 * Per-message campaign send — runs on email-send / sms-send queues.
 * Claim → provider throttle → Twilio/Brevo → status update → sequence advance.
 */

import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { PlanLimitError, releaseUsage, reserveUsage } from "@/lib/plans";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import { buildInboundReplyAddress } from "@/lib/reputation/inbound-reply";
import { buildUnsubscribeUrl } from "@/lib/reputation/unsubscribe";
import { appendSmsOptOut } from "@/lib/reputation/phone";
import { sendTwilioSms } from "@/lib/reputation/twilio";
import { claimQueuedCampaignMessage } from "@/lib/reputation/campaign-claim";
import { tryAdvanceRecipientAfterSend } from "@/lib/reputation/sequence-runner";
import { acquireProviderSlot } from "@/lib/queue/provider-limiter";
import { logger } from "@/lib/observability/logger";

const PERMANENT_FAIL =
  /missing recipient|invalid.*(phone|email|key)|key not found|not configured|unauthorized|forbidden|unrecognised|api key rejected|opt.?out/i;

export type SendCampaignMessageResult = {
  ok: boolean;
  permanent?: boolean;
  skipped?: boolean;
  error?: string;
  channel?: string;
};

/**
 * Deliver one review_request_messages row. Idempotent when already sent.
 */
export async function sendCampaignMessageById(
  messageId: string
): Promise<SendCampaignMessageResult> {
  const supabase = createServiceClient();
  const { data: msg } = await supabase
    .from("review_request_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) return { ok: false, permanent: true, error: "Message not found" };

  {
    const orgForPause = String(msg.organization_id ?? "");
    if (orgForPause) {
      const { isOutboundPaused } = await import("@/lib/auth/entitlements");
      if (await isOutboundPaused(orgForPause)) {
        return {
          ok: false,
          permanent: true,
          error: "Outbound messaging is paused for this organization",
        };
      }
    }
  }

  const status = String(msg.status);
  if (["sent", "delivered", "clicked", "opted_out"].includes(status)) {
    return { ok: true, skipped: true, channel: String(msg.channel ?? "") };
  }
  if (status === "failed" && msg.provider_message_id) {
    // Provider already accepted — do not resend.
    return { ok: true, skipped: true, channel: String(msg.channel ?? "") };
  }
  if (status === "cancelled" || status === "canceled") {
    return { ok: true, skipped: true, channel: String(msg.channel ?? "") };
  }

  const claimTs = new Date().toISOString();
  let claimed = msg;

  if (status === "queued") {
    const took = await claimQueuedCampaignMessage(
      supabase as unknown as Parameters<typeof claimQueuedCampaignMessage>[0],
      messageId,
      claimTs
    );
    if (!took) {
      // Another worker claimed it, or already terminal.
      const { data: again } = await supabase
        .from("review_request_messages")
        .select("status, channel")
        .eq("id", messageId)
        .maybeSingle();
      if (again && ["sent", "delivered", "clicked", "sending"].includes(String(again.status))) {
        return { ok: true, skipped: true, channel: String(again.channel ?? "") };
      }
      return { ok: false, error: "Message claim lost — retry" };
    }
    claimed = took;
  } else if (status === "sending") {
    // Retry path: continue only if provider never confirmed.
    if (msg.provider_message_id) {
      await supabase
        .from("review_request_messages")
        .update({
          status: "sent",
          sent_at: claimTs,
          updated_at: claimTs,
        })
        .eq("id", messageId)
        .eq("status", "sending");
      await tryAdvanceRecipientAfterSend({
        supabase,
        recipientId: String(msg.recipient_id),
        stepKey: String(msg.step_key ?? "initial"),
      }).catch(() => undefined);
      return { ok: true, skipped: true, channel: String(msg.channel ?? "") };
    }
  } else {
    return { ok: false, permanent: true, error: `Unexpected message status ${status}` };
  }

  const organizationId = String(claimed.organization_id ?? "");
  const businessId = String(claimed.business_id ?? "");
  const campaignId = String(claimed.campaign_id ?? "");
  const channel = String(claimed.channel ?? "");

  const { data: recipient } = await supabase
    .from("review_request_recipients")
    .select("phone, email, first_name, full_name")
    .eq("id", claimed.recipient_id)
    .maybeSingle();

  if (recipient?.phone || recipient?.email) {
    let suppressed = false;
    if ((channel === "sms" || channel === "both" || !channel) && recipient.phone) {
      const { data } = await supabase
        .from("review_request_suppression")
        .select("id, expires_at")
        .eq("business_id", businessId)
        .eq("phone", recipient.phone)
        .limit(5);
      suppressed = Boolean(
        (data ?? []).some(
          (s) => !s.expires_at || new Date(String(s.expires_at)).getTime() > Date.now()
        )
      );
    }
    if (!suppressed && (channel === "email" || channel === "both" || !channel) && recipient.email) {
      const { data } = await supabase
        .from("review_request_suppression")
        .select("id, expires_at")
        .eq("business_id", businessId)
        .eq("email", recipient.email.toLowerCase())
        .limit(5);
      suppressed = Boolean(
        (data ?? []).some(
          (s) => !s.expires_at || new Date(String(s.expires_at)).getTime() > Date.now()
        )
      );
    }
    if (suppressed) {
      await supabase
        .from("review_request_messages")
        .update({ status: "opted_out", updated_at: claimTs })
        .eq("id", claimed.id)
        .eq("status", "sending");
      await supabase
        .from("review_request_recipients")
        .update({
          workflow_status: "opted_out",
          next_action_at: null,
          updated_at: claimTs,
        })
        .eq("id", claimed.recipient_id);
      return { ok: true, skipped: true, channel };
    }
  }

  const usageKey = channel === "sms" ? "review_sms_sent" : "review_emails_sent";
  try {
    await reserveUsage(organizationId, usageKey, 1, { enforceLimit: true });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      await supabase
        .from("review_request_messages")
        .update({ status: "queued", updated_at: claimTs })
        .eq("id", claimed.id)
        .eq("status", "sending");
      if (campaignId) {
        await supabase
          .from("review_request_campaigns")
          .update({
            status: "paused",
            auto_pause_reason: `plan_limit:${err.limitKey}`,
            updated_at: claimTs,
          })
          .eq("id", campaignId)
          .in("status", ["active", "scheduled"]);
      }
      return {
        ok: false,
        permanent: true,
        error: `Plan limit: ${err.limitKey}`,
        channel,
      };
    }
    throw err;
  }

  const business = await getBusiness(businessId, organizationId);
  const provider = channel === "sms" ? "twilio" : "brevo";
  let slot: { release: () => Promise<void> } | null = null;
  let ok = false;
  let providerId: string | null = null;
  let failReason: string | null = null;

  try {
    slot = await acquireProviderSlot(provider, 30_000);

    if (channel === "sms" && recipient?.phone) {
      let body = String(claimed.message_body ?? "");
      body = appendSmsOptOut(body);

      // Prefer per-customer ISV Messaging Service when A2P registration is ready.
      const { getRegistration } = await import("@/lib/messaging/store");
      const { isLiveMessagingReady, sendSmsViaMessagingService } = await import(
        "@/lib/messaging/twilio-onboarding"
      );
      const { isLiveTwilioMessaging } = await import("@/lib/messaging/twilio-config");
      const messagingReg = await getRegistration({
        organizationId,
        businessId,
        businessName: business?.name ?? "Business",
      });

      if (isLiveTwilioMessaging() || messagingReg.adapterMode === "twilio") {
        if (messagingReg.messagingPaused) {
          failReason = "Messaging is paused for this business";
        } else if (!isLiveMessagingReady(messagingReg)) {
          failReason =
            "A2P registration is not ready — SMS blocked until campaign is VERIFIED and a number is attached";
        } else {
          const result = await sendSmsViaMessagingService({
            registration: messagingReg,
            toPhone: recipient.phone,
            body,
          });
          ok = result.ok;
          if (result.ok) providerId = result.messageSid;
          else failReason = result.error;
        }
      } else {
        const result = await sendTwilioSms({
          toPhone: recipient.phone,
          body,
          organizationId,
          businessId,
          idempotencyKey: `twilio:msg:${claimed.id}`,
        });
        ok = result.ok;
        if (result.ok) providerId = result.messageSid;
        else failReason = result.error;
      }
    } else if (channel === "email" && recipient?.email) {
      const result = await sendBrevoEmail({
        toEmail: recipient.email,
        toName: recipient.full_name ?? recipient.first_name ?? undefined,
        fromName: business?.name,
        subject: String(claimed.subject ?? `Feedback for ${business?.name ?? "us"}`),
        textBody: String(claimed.message_body ?? ""),
        replyToEmail: buildInboundReplyAddress(String(claimed.id)),
        listUnsubscribeUrl: buildUnsubscribeUrl(String(claimed.id)),
        organizationId,
        businessId,
        idempotencyKey: `brevo:msg:${claimed.id}`,
      });
      ok = result.ok;
      if (result.ok) providerId = result.messageId;
      else failReason = result.error;
    } else {
      failReason = "Missing recipient contact for channel";
    }
  } catch (e) {
    failReason = e instanceof Error ? e.message : "Send failed";
  } finally {
    await slot?.release().catch(() => undefined);
  }

  if (ok && providerId) {
    await supabase
      .from("review_request_messages")
      .update({ provider_message_id: providerId, updated_at: new Date().toISOString() })
      .eq("id", claimed.id)
      .eq("status", "sending");
  }

  const ts = new Date().toISOString();
  if (ok) {
    await supabase
      .from("review_request_messages")
      .update({
        status: "sent",
        sent_at: ts,
        provider_message_id: providerId,
        updated_at: ts,
      })
      .eq("id", claimed.id)
      .eq("status", "sending");
    logger.info("campaign_message_sent", {
      campaignId,
      businessId,
      recipientId: claimed.recipient_id,
      messageId: claimed.id,
      channel,
      provider,
    });
    await tryAdvanceRecipientAfterSend({
      supabase,
      recipientId: String(claimed.recipient_id),
      stepKey: String(claimed.step_key ?? "initial"),
    }).catch((err) => {
      logger.warn("sequence_advance_after_send_failed", {
        messageId: claimed.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    return { ok: true, channel };
  }

  await releaseUsage(organizationId, usageKey, 1).catch(() => undefined);

  const permanent = Boolean(failReason && PERMANENT_FAIL.test(failReason));
  if (permanent) {
    await supabase
      .from("review_request_messages")
      .update({
        status: "failed",
        failed_at: ts,
        failed_reason: failReason,
        updated_at: ts,
      })
      .eq("id", claimed.id)
      .eq("status", "sending");
    await tryAdvanceRecipientAfterSend({
      supabase,
      recipientId: String(claimed.recipient_id),
      stepKey: String(claimed.step_key ?? "initial"),
    }).catch(() => undefined);
    return { ok: false, permanent: true, error: failReason ?? "Send failed", channel };
  }

  // Retryable — release claim back to queued so another attempt can claim cleanly.
  await supabase
    .from("review_request_messages")
    .update({
      status: "queued",
      failed_reason: failReason,
      updated_at: ts,
    })
    .eq("id", claimed.id)
    .eq("status", "sending");

  return { ok: false, permanent: false, error: failReason ?? "Send failed", channel };
}
