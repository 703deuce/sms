import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export type StoreReviewReplyParams = {
  organizationId: string;
  businessId: string;
  campaignId?: string | null;
  recipientId?: string | null;
  messageId?: string | null;
  sendId?: string | null;
  channel: "sms" | "email";
  body: string;
  fromAddress?: string | null;
  providerSid?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Persist an inbound customer reply. Idempotent on provider_sid when present
 * (Twilio MessageSid / Brevo uuid) so webhook retries do not duplicate rows.
 */
export async function storeReviewReply(params: StoreReviewReplyParams): Promise<{
  id: string | null;
  inserted: boolean;
}> {
  const supabase = createServiceClient();
  const sid = params.providerSid?.trim() || null;

  if (sid) {
    const { data: existing } = await supabase
      .from("review_request_replies")
      .select("id")
      .eq("provider_sid", sid)
      .maybeSingle();
    if (existing?.id) {
      return { id: existing.id as string, inserted: false };
    }
  }

  const { data, error } = await supabase
    .from("review_request_replies")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      campaign_id: params.campaignId ?? null,
      recipient_id: params.recipientId ?? null,
      message_id: params.messageId ?? null,
      send_id: params.sendId ?? null,
      channel: params.channel,
      body: params.body ?? "",
      from_address: params.fromAddress ?? null,
      provider_sid: sid,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique race on provider_sid — treat as already stored.
    if (sid && /duplicate|unique/i.test(error.message)) {
      const { data: again } = await supabase
        .from("review_request_replies")
        .select("id")
        .eq("provider_sid", sid)
        .maybeSingle();
      return { id: (again?.id as string) ?? null, inserted: false };
    }
    logger.error("review_reply_store_failed", { error: error.message, channel: params.channel });
    throw new Error(error.message);
  }

  return { id: (data?.id as string) ?? null, inserted: true };
}
