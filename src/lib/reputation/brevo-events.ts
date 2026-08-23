import { createServiceClient } from "@/lib/db/client";
import { applyProviderDeliveryStatus } from "@/lib/reputation/delivery-status";
import { applyEmailUnsubscribe } from "@/lib/reputation/unsubscribe";
import { addSuppression } from "@/lib/reputation/bulk-validate";
import { normalizeEmail } from "@/lib/reputation/contacts-normalize";
import { providerMessageIdVariants } from "@/lib/reputation/provider-ids";
import { logger } from "@/lib/observability/logger";

/**
 * Map Brevo transactional webhook events onto campaign messages / suppressions.
 * @see https://developers.brevo.com/docs/transactional-webhooks
 */
export async function handleBrevoTransactionalEvent(raw: Record<string, unknown>): Promise<{
  handled: boolean;
  event?: string;
}> {
  const event = String(raw.event ?? raw.Event ?? "").toLowerCase();
  const messageId = String(
    raw["message-id"] ?? raw.messageId ?? raw["Message-Id"] ?? raw.tags ?? ""
  ).trim();
  const providerId = messageId.replace(/^<|>$/g, "").trim();
  const email = normalizeEmail(String(raw.email ?? raw.Email ?? ""));

  if (!event) return { handled: false };

  if (["delivered", "delivery"].includes(event) && providerId) {
    const ok = await applyProviderDeliveryStatus({
      providerMessageId: providerId,
      status: "delivered",
    });
    return { handled: ok, event };
  }

  if (["request", "sent", "unique_opened", "opened", "click", "unique_click"].includes(event)) {
    if (event === "click" || event === "unique_click") {
      // Tracking is primary via /r/; ignore soft click events here.
      return { handled: true, event };
    }
    return { handled: true, event };
  }

  if (["hard_bounce", "soft_bounce", "invalid_email", "blocked", "error"].includes(event)) {
    if (providerId) {
      await applyProviderDeliveryStatus({
        providerMessageId: providerId,
        status: "failed",
        errorCode: event,
      });
    }
    if (email && ["hard_bounce", "invalid_email", "blocked"].includes(event)) {
      await suppressByEmail(email, `brevo:${event}`, providerId || null);
    }
    return { handled: true, event };
  }

  if (["spam", "complaint"].includes(event)) {
    if (providerId) {
      await applyProviderDeliveryStatus({
        providerMessageId: providerId,
        status: "failed",
        errorCode: event,
      });
    }
    if (email) await suppressByEmail(email, `brevo:${event}`, providerId || null);
    return { handled: true, event };
  }

  if (["unsubscribed", "unsubscribe"].includes(event)) {
    if (providerId) {
      const supabase = createServiceClient();
      const variants = providerMessageIdVariants(providerId);
      const { data: messages } = await supabase
        .from("review_request_messages")
        .select("id")
        .in("provider_message_id", variants)
        .limit(1);
      const message = messages?.[0] ?? null;
      if (message) {
        await applyEmailUnsubscribe(message.id as string);
        return { handled: true, event };
      }
    }
    if (email) await suppressByEmail(email, "brevo:unsubscribed", providerId || null);
    return { handled: true, event };
  }

  logger.info("brevo_event_ignored", { event, providerId: providerId || null });
  return { handled: false, event };
}

async function suppressByEmail(
  email: string,
  reason: string,
  providerMessageId: string | null
): Promise<void> {
  const supabase = createServiceClient();
  let organizationId: string | null = null;
  let businessId: string | null = null;

  if (providerMessageId) {
    const variants = providerMessageIdVariants(providerMessageId);
    const { data: messages } = await supabase
      .from("review_request_messages")
      .select("organization_id, business_id, recipient_id")
      .in("provider_message_id", variants)
      .limit(1);
    const message = messages?.[0] ?? null;
    if (message) {
      organizationId = message.organization_id as string;
      businessId = message.business_id as string;
      await supabase
        .from("review_request_recipients")
        .update({
          workflow_status: "opted_out",
          next_action_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", message.recipient_id);
    }

    if (!businessId) {
      const { data: sends } = await supabase
        .from("review_request_sends")
        .select("organization_id, business_id")
        .in("provider_message_id", variants)
        .limit(1);
      const send = sends?.[0] ?? null;
      if (send) {
        organizationId = send.organization_id as string;
        businessId = send.business_id as string;
      }
    }
  }

  if (!businessId) {
    // Prefer one-off send match (scoped by email) over bare recipient scan.
    const { data: sendByEmail } = await supabase
      .from("review_request_sends")
      .select("organization_id, business_id")
      .eq("recipient_email", email)
      .order("created_at", { ascending: false })
      .limit(2);
    if ((sendByEmail ?? []).length === 1) {
      organizationId = sendByEmail![0]!.organization_id as string;
      businessId = sendByEmail![0]!.business_id as string;
    } else if ((sendByEmail ?? []).length > 1) {
      const biz = new Set((sendByEmail ?? []).map((s) => s.business_id));
      if (biz.size === 1) {
        organizationId = sendByEmail![0]!.organization_id as string;
        businessId = sendByEmail![0]!.business_id as string;
      }
    }
  }

  if (!businessId) {
    const { data: recipRows } = await supabase
      .from("review_request_recipients")
      .select("organization_id, business_id")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(2);
    if ((recipRows ?? []).length === 1) {
      organizationId = recipRows![0]!.organization_id as string;
      businessId = recipRows![0]!.business_id as string;
    } else if ((recipRows ?? []).length > 1) {
      const biz = new Set((recipRows ?? []).map((r) => r.business_id));
      if (biz.size === 1) {
        organizationId = recipRows![0]!.organization_id as string;
        businessId = recipRows![0]!.business_id as string;
      } else {
        logger.warn("brevo_suppress_ambiguous_email", { email });
        return;
      }
    }
  }

  if (!organizationId || !businessId) return;

  await addSuppression({
    organizationId,
    businessId,
    email,
    reason,
  });

  await supabase
    .from("review_request_contacts")
    .update({
      email_unsubscribed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("email_normalized", email);
}

export function parseBrevoEventPayload(body: unknown): Record<string, unknown>[] {
  if (!body) return [];
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (typeof body === "object") {
    const root = body as Record<string, unknown>;
    if (Array.isArray(root.items)) return root.items as Record<string, unknown>[];
    return [root];
  }
  return [];
}
