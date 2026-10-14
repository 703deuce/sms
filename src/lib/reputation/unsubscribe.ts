import { createHmac, timingSafeEqual } from "crypto";
import { appUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/db/client";
import { addSuppression } from "@/lib/reputation/bulk-validate";
import { normalizeEmail } from "@/lib/reputation/contacts-normalize";

function unsubSecret(): string {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.BREVO_API_KEY?.trim() ||
    "dev-unsub-secret"
  );
}

/** Signed token: messageId.exp.sig — short-lived enough for campaign windows. */
export function buildUnsubscribeToken(messageId: string, ttlDays = 180): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const payload = `${messageId}.${exp}`;
  const sig = createHmac("sha256", unsubSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): { messageId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [messageId, expStr, sig] = parts;
  if (!messageId || !expStr || !sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const payload = `${messageId}.${expStr}`;
  const expected = createHmac("sha256", unsubSecret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { messageId };
}

export function buildUnsubscribeUrl(messageId: string): string | null {
  const token = buildUnsubscribeToken(messageId);
  return `${appUrl("/api/reputation/unsubscribe")}?token=${encodeURIComponent(token)}`;
}

/**
 * Mark campaign message recipient + contact as email-unsubscribed and suppress future sends.
 */
export async function applyEmailUnsubscribe(messageId: string): Promise<{
  ok: boolean;
  already?: boolean;
}> {
  const supabase = createServiceClient();
  const { data: message } = await supabase
    .from("review_request_messages")
    .select("id, organization_id, business_id, recipient_id, status")
    .eq("id", messageId)
    .maybeSingle();

  if (!message) {
    // One-off sends: token may point at review_request_sends id
    const { data: send } = await supabase
      .from("review_request_sends")
      .select("id, organization_id, business_id, recipient_email, contact_id")
      .eq("id", messageId)
      .maybeSingle();
    if (!send?.recipient_email) return { ok: false };
    const email = normalizeEmail(send.recipient_email);
    if (!email) return { ok: false };
    await addSuppression({
      organizationId: send.organization_id,
      businessId: send.business_id,
      email,
      reason: "email_unsubscribe",
    });
    if (send.contact_id) {
      await supabase
        .from("review_request_contacts")
        .update({ email_unsubscribed: true, updated_at: new Date().toISOString() })
        .eq("id", send.contact_id);
    }
    return { ok: true };
  }

  const { data: recipient } = await supabase
    .from("review_request_recipients")
    .select("id, email, phone, workflow_status")
    .eq("id", message.recipient_id)
    .maybeSingle();

  const email = normalizeEmail(recipient?.email);
  if (!email) return { ok: false };

  const now = new Date().toISOString();
  await addSuppression({
    organizationId: message.organization_id,
    businessId: message.business_id,
    email,
    reason: "email_unsubscribe",
  });

  // Email unsubscribe must not kill SMS — only cancel email channel queue.
  await supabase
    .from("review_request_messages")
    .update({ status: "opted_out", updated_at: now })
    .eq("recipient_id", message.recipient_id)
    .eq("channel", "email")
    .in("status", ["queued", "sending"]);

  await supabase
    .from("review_request_contacts")
    .update({ email_unsubscribed: true, updated_at: now })
    .eq("business_id", message.business_id)
    .eq("email_normalized", email);

  // If SMS still has open work, keep the workflow alive for SMS only.
  const { count: openSms } = await supabase
    .from("review_request_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", message.recipient_id)
    .eq("channel", "sms")
    .in("status", ["queued", "sending"]);

  if ((openSms ?? 0) === 0) {
    await supabase
      .from("review_request_recipients")
      .update({
        workflow_status: "opted_out",
        next_action_at: null,
        updated_at: now,
      })
      .eq("id", message.recipient_id);
  }

  return { ok: true };
}
