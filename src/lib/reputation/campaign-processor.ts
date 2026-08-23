import { createServiceClient } from "@/lib/db/client";
import { isBillingHealthy, hasEntitlement, isOutboundPaused } from "@/lib/auth/entitlements";
import {
  campaignImmediateSendEnabled,
  countSentTodayInTz,
  isOnOrAfterStartDate,
  isWithinSendWindow,
  ymdInTimeZone,
  type ScheduleConfig,
} from "@/lib/reputation/campaign-scheduler";
import { logger } from "@/lib/observability/logger";
import {
  processSequenceWaits,
  tryAdvanceRecipientAfterSend,
} from "@/lib/reputation/sequence-runner";
import { attributeRecentReviewsForBusiness } from "@/lib/reputation/attribution";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

/** Requeue messages stuck in sending if a worker died mid-flight. */
const SENDING_STALE_MS = Number(process.env.CAMPAIGN_SENDING_STALE_MS ?? 15 * 60 * 1000);

async function reclaimStaleSending(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date
): Promise<void> {
  const staleBefore = new Date(now.getTime() - SENDING_STALE_MS).toISOString();

  // Provider succeeded but DB never flipped to sent — mark sent instead of requeueing
  // (avoids double-send), then advance sequence so drips don't stall.
  const { data: reclaimed } = await supabase
    .from("review_request_messages")
    .update({ status: "sent", sent_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleBefore)
    .not("provider_message_id", "is", null)
    .select("id, recipient_id, step_key");

  for (const msg of reclaimed ?? []) {
    await tryAdvanceRecipientAfterSend({
      supabase,
      recipientId: String(msg.recipient_id),
      stepKey: String(msg.step_key ?? "initial"),
    }).catch(() => undefined);
  }

  // Truly abandoned mid-flight with no provider confirmation — safe to retry.
  await supabase
    .from("review_request_messages")
    .update({ status: "queued", updated_at: now.toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleBefore)
    .is("provider_message_id", null);
}

/**
 * Campaign drain (orchestrator): find due queued messages and enqueue
 * per-message `send_campaign_email` / `send_campaign_sms` jobs.
 * Does NOT call Twilio/Brevo — messaging workers own delivery.
 *
 * @returns number of send jobs enqueued (or reused via idempotency)
 */
export async function enqueueDueCampaignMessages(limit = 100): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date();

  await reclaimStaleSending(supabase, now);

  // Advance wait/condition/reminder steps (CAS-locked per recipient).
  await processSequenceWaits(Math.min(50, limit * 2));

  const { data: campaigns } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .in("status", ["active", "scheduled"]);

  if (!campaigns?.length) return 0;

  let enqueued = 0;

  for (const campaign of campaigns) {
    if (enqueued >= limit) break;

    // Billing / add-on guard — pause outbound rather than send while ineligible.
    if (!(await hasEntitlement(campaign.organization_id, "review_campaigns"))) {
      await supabase
        .from("review_request_campaigns")
        .update({
          status: "paused",
          auto_pause_reason: "entitlement_missing",
          updated_at: now.toISOString(),
        })
        .eq("id", campaign.id)
        .in("status", ["active", "scheduled"]);
      continue;
    }
    if (!(await isBillingHealthy(campaign.organization_id))) {
      await supabase
        .from("review_request_campaigns")
        .update({
          status: "paused",
          auto_pause_reason: "billing_inactive",
          updated_at: now.toISOString(),
        })
        .eq("id", campaign.id)
        .in("status", ["active", "scheduled"]);
      continue;
    }
    if (await isOutboundPaused(campaign.organization_id)) {
      await supabase
        .from("review_request_campaigns")
        .update({
          status: "paused",
          auto_pause_reason: "outbound_paused",
          updated_at: now.toISOString(),
        })
        .eq("id", campaign.id)
        .in("status", ["active", "scheduled"]);
      continue;
    }

    if (campaign.status === "scheduled" && campaign.start_date) {
      const tz = (campaign.timezone as string) || "America/New_York";
      if (!isOnOrAfterStartDate(now, String(campaign.start_date), tz)) continue;
      await supabase
        .from("review_request_campaigns")
        .update({ status: "active", started_at: now.toISOString() })
        .eq("id", campaign.id)
        .eq("status", "scheduled");
    }

    const config: ScheduleConfig = {
      startDate:
        campaign.start_date ??
        ymdInTimeZone(now, (campaign.timezone as string) || "America/New_York"),
      dailySendLimit: campaign.daily_send_limit,
      sendDays: campaign.send_days as number[],
      windowStart: campaign.send_window_start,
      windowEnd: campaign.send_window_end,
      timezone: campaign.timezone,
    };

    if (!isWithinSendWindow(now, config)) continue;

    const sentSince = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: sentTodayRows } = await supabase
      .from("review_request_messages")
      .select("sent_at")
      .eq("campaign_id", campaign.id)
      .in("status", ["sent", "delivered", "clicked"])
      .gte("sent_at", sentSince)
      .not("sent_at", "is", null);

    const { count: sendingCount } = await supabase
      .from("review_request_messages")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .eq("status", "sending");

    const sentToday =
      countSentTodayInTz(
        (sentTodayRows ?? []).map((r) => r.sent_at as string),
        campaign.timezone,
        now
      ) + (sendingCount ?? 0);
    const remaining = campaignImmediateSendEnabled()
      ? limit - enqueued
      : Math.max(0, campaign.daily_send_limit - sentToday);
    if (!campaignImmediateSendEnabled() && remaining <= 0) continue;

    const take = Math.min(limit - enqueued, remaining);
    let queuedQuery = supabase
      .from("review_request_messages")
      .select("id, channel, organization_id, business_id, campaign_id")
      .eq("campaign_id", campaign.id)
      .eq("status", "queued")
      .order("scheduled_for", { ascending: true })
      .limit(take);

    if (!campaignImmediateSendEnabled()) {
      queuedQuery = queuedQuery.lte("scheduled_for", now.toISOString());
    }

    const { data: queued } = await queuedQuery;

    if (!queued?.length) {
      const { count } = await supabase
        .from("review_request_messages")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .in("status", ["queued", "sending"]);
      const { count: waitingCount } = await supabase
        .from("review_request_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .in("workflow_status", ["waiting", "in_progress", "scheduled"]);
      const isAutomaticTrigger =
        campaign.trigger_type === "webhook" || campaign.trigger_type === "api";
      const { count: triggerLinks } = await supabase
        .from("integration_webhook_endpoints")
        .select("id", { count: "exact", head: true })
        .or(`campaign_id.eq.${campaign.id},default_campaign_id.eq.${campaign.id}`)
        .eq("is_active", true)
        .is("revoked_at", null);
      const keepAlive = isAutomaticTrigger || (triggerLinks ?? 0) > 0;
      if (count === 0 && (waitingCount ?? 0) === 0 && !keepAlive) {
        await supabase
          .from("review_request_campaigns")
          .update({ status: "completed", completed_at: now.toISOString() })
          .eq("id", campaign.id)
          .in("status", ["active", "scheduled"]);
      } else {
        await attributeRecentReviewsForBusiness({
          businessId: campaign.business_id,
          organizationId: campaign.organization_id,
          campaignId: campaign.id,
        }).catch(() => undefined);
      }
      continue;
    }

    for (const msg of queued) {
      if (enqueued >= limit) break;
      const channel = String(msg.channel ?? "");
      const jobType = channel === "sms" ? "send_campaign_sms" : "send_campaign_email";
      try {
        const result = await dispatchFeatureJob({
          jobType,
          payload: {
            messageId: msg.id,
            campaignId: msg.campaign_id,
            channel,
          },
          organizationId: String(msg.organization_id ?? campaign.organization_id),
          businessId: String(msg.business_id ?? campaign.business_id),
          relatedResourceId: String(msg.id),
          idempotencyKey: `campaign-msg-send:${msg.id}`,
          priority: "normal",
          maxAttempts: 5,
          // Under database driver, let the cron claimer / after() pick these up.
          // Avoid exploding after() callbacks when enqueuing large batches.
          kickImmediately: enqueued < 5,
        });
        if (result.enqueueState === "enqueued" || result.reused) {
          enqueued++;
        } else {
          logger.warn("campaign_message_enqueue_state", {
            messageId: msg.id,
            enqueueState: result.enqueueState,
          });
        }
      } catch (err) {
        logger.warn("campaign_message_enqueue_failed", {
          messageId: msg.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (enqueued > 0) {
    logger.info("campaign_messages_enqueued", { count: enqueued });
  }
  return enqueued;
}

/**
 * @deprecated Prefer enqueueDueCampaignMessages — kept for callers/tests.
 * Now only enqueues per-message jobs (does not send inline).
 */
export async function processCampaignMessages(limit = 100): Promise<number> {
  return enqueueDueCampaignMessages(limit);
}
