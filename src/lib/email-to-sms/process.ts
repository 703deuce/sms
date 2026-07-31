import { getPrisma } from "@/lib/db";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type EmailToSmsInbound = {
  to: string;
  from: string;
  subject?: string;
  text?: string;
};

export function parseEmailToSmsAddress(to: string, domain?: string): string | null {
  const d = domain || process.env.EMAIL_TO_SMS_DOMAIN || "sms.transovo.ai";
  const lower = to.trim().toLowerCase();
  const at = lower.indexOf("@");
  if (at < 1) return null;
  const localPart = lower.slice(0, at);
  const host = lower.slice(at + 1);
  if (host !== d.toLowerCase()) return null;
  return localPart.replace(/[^a-z0-9._+-]/g, "");
}

export async function processEmailToSmsInbound(input: EmailToSmsInbound) {
  const localPart = parseEmailToSmsAddress(input.to);
  if (!localPart) {
    return { ok: false as const, error: "invalid_to_address" };
  }

  const prisma = getPrisma();
  const mapping = await prisma.emailToSmsAddress.findFirst({
    where: { localPart, active: true },
  });
  if (!mapping) {
    return { ok: false as const, error: "mapping_not_found" };
  }

  const phoneRaw = mapping.phoneE164 || mapping.fromNumber;
  if (!phoneRaw) {
    return { ok: false as const, error: "no_destination_phone" };
  }

  let phone: string;
  try {
    phone = normalizeE164(phoneRaw);
  } catch {
    return { ok: false as const, error: "invalid_destination_phone" };
  }

  const subject = (input.subject || "").trim();
  const text = (input.text || "").trim();
  const body = [subject, text].filter(Boolean).join("\n").trim() || "(empty email)";
  const fromLabel = (input.from || "email").slice(0, 80);

  const smsBody = `Email from ${fromLabel}:\n${body}`.slice(0, 1500);

  const idempotencyKey = `email-to-sms:${mapping.id}:${input.from}:${subject}:${text.slice(0, 40)}`;

  try {
    const result = await sendQuickSms({
      workspaceId: mapping.workspaceId,
      to: phone,
      body: smsBody,
      from: mapping.fromNumber || undefined,
      idempotencyKey,
    });
    return { ok: true as const, messageId: result.messageId, phone };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: message };
  }
}
