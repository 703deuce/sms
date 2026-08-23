import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { providerMessageIdVariants } from "@/lib/reputation/provider-ids";

/**
 * Apply Twilio MessageStatus (or Brevo-equivalent) onto campaign messages
 * and one-off review_request_sends. Idempotent: already-clicked rows keep clicked;
 * delivered upgrades sent.
 */
export async function applyProviderDeliveryStatus(params: {
  providerMessageId: string;
  status: string;
  errorCode?: string | null;
}): Promise<boolean> {
  const sid = params.providerMessageId?.trim();
  if (!sid) return false;

  const normalized = params.status.trim().toLowerCase();
  const supabase = createServiceClient();
  const variants = providerMessageIdVariants(sid);

  const { data: messages } = await supabase
    .from("review_request_messages")
    .select("id, status")
    .in("provider_message_id", variants)
    .limit(1);
  const message = messages?.[0] ?? null;

  if (message) {
    return applyCampaignMessageStatus({
      messageId: message.id as string,
      current: String(message.status),
      normalized,
      errorCode: params.errorCode,
    });
  }

  const { data: sends } = await supabase
    .from("review_request_sends")
    .select("id, status")
    .in("provider_message_id", variants)
    .limit(1);
  const send = sends?.[0] ?? null;

  if (!send) return false;

  return applyOneOffSendStatus({
    sendId: send.id as string,
    current: String(send.status),
    normalized,
    errorCode: params.errorCode,
  });
}

async function applyCampaignMessageStatus(params: {
  messageId: string;
  current: string;
  normalized: string;
  errorCode?: string | null;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { messageId, current, normalized } = params;

  if (normalized === "delivered") {
    if (current === "clicked" || current === "opted_out") return true;
    await supabase
      .from("review_request_messages")
      .update({
        status: "delivered",
        delivered_at: now,
        updated_at: now,
      })
      .eq("id", messageId)
      .in("status", ["sent", "sending", "delivered"]);
    return true;
  }

  if (normalized === "sent" || normalized === "queued" || normalized === "accepted") {
    return true;
  }

  if (
    normalized === "failed" ||
    normalized === "undelivered" ||
    normalized === "delivery_unknown"
  ) {
    if (["clicked", "delivered", "opted_out"].includes(current)) return true;
    await supabase
      .from("review_request_messages")
      .update({
        status: "failed",
        failed_at: now,
        failed_reason: `provider:${normalized}${params.errorCode ? `:${params.errorCode}` : ""}`,
        error_code: params.errorCode ?? null,
        updated_at: now,
      })
      .eq("id", messageId)
      .in("status", ["sent", "sending", "queued"]);
    logger.info("campaign_message_provider_failed", {
      messageId,
      providerStatus: normalized,
      errorCode: params.errorCode ?? null,
    });
    return true;
  }

  return false;
}

async function applyOneOffSendStatus(params: {
  sendId: string;
  current: string;
  normalized: string;
  errorCode?: string | null;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { sendId, current, normalized } = params;

  if (normalized === "delivered") {
    if (current === "clicked" || current === "completed") return true;
    await supabase
      .from("review_request_sends")
      .update({
        status: "delivered",
        delivered_at: now,
      })
      .eq("id", sendId)
      .in("status", ["queued", "sent", "delivered"]);
    return true;
  }

  if (normalized === "sent" || normalized === "queued" || normalized === "accepted") {
    return true;
  }

  if (
    normalized === "failed" ||
    normalized === "undelivered" ||
    normalized === "delivery_unknown"
  ) {
    if (["clicked", "delivered", "completed"].includes(current)) return true;
    await supabase
      .from("review_request_sends")
      .update({
        status: "failed",
        error_message: `provider:${normalized}${params.errorCode ? `:${params.errorCode}` : ""}`,
      })
      .eq("id", sendId)
      .in("status", ["queued", "sent"]);
    logger.info("review_send_provider_failed", {
      sendId,
      providerStatus: normalized,
      errorCode: params.errorCode ?? null,
    });
    return true;
  }

  return false;
}
