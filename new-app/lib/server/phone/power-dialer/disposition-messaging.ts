import { getPrisma } from "@/lib/server/db";

export async function sendDispositionSms(input: {
  workspaceId: string;
  contactId: string;
  body: string;
  templateId?: string;
}): Promise<{ ok: boolean; message: string }> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { phone: true, status: true, id: true },
  });
  if (!contact?.phone) return { ok: false, message: "Contact has no phone number" };
  if (contact.status === "BLOCKED") {
    return { ok: false, message: "Contact is opted out or blocked" };
  }

  const onDnc = await (await import("./internal-dnc")).isOnInternalDnc(
    input.workspaceId,
    contact.phone,
  );
  if (onDnc) return { ok: false, message: "Number is on workspace DNC list" };

  const { getPowerDialerSettings } = await import("@/lib/server/phone/power-dialer");
  const ws = await getPowerDialerSettings(input.workspaceId);
  const { isCallingWindowOpen } = await import("./timezone-window");
  const tz = ws.defaultTimezone || "America/Chicago";
  const window = isCallingWindowOpen(new Date(), tz, [0, 1, 2, 3, 4, 5, 6], "08:00", "21:00");
  if (!window.open) {
    return { ok: false, message: "Outside allowed messaging hours for workspace timezone" };
  }

  const body = input.body.trim();
  if (!body) return { ok: false, message: "SMS body is empty" };

  try {
    const { sendQuickSms } = await import("@/lib/sms/send-quick");
    await sendQuickSms({
      workspaceId: input.workspaceId,
      to: contact.phone,
      body,
    });
    return { ok: true, message: "SMS queued" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}

export async function sendDispositionEmail(input: {
  workspaceId: string;
  contactId: string;
  subject: string;
  body: string;
  templateId?: string;
}): Promise<{ ok: boolean; message: string }> {
  const prisma = getPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: input.workspaceId },
    select: { email: true, status: true },
  });
  if (!contact?.email) return { ok: false, message: "Contact has no email address" };
  if (contact.status === "BLOCKED") {
    return { ok: false, message: "Contact is blocked" };
  }

  const subject = input.subject;
  const body = input.body;
  if (!body.trim()) return { ok: false, message: "Email body is empty" };

  const provider = process.env.TRANSOVO_OUTBOUND_EMAIL_WEBHOOK_URL?.trim();
  if (!provider) {
    const cf =
      contact && typeof (await prisma.contact.findFirst({
        where: { id: input.contactId },
        select: { customFields: true },
      }))?.customFields === "object"
        ? ((await prisma.contact.findFirst({
            where: { id: input.contactId },
            select: { customFields: true },
          }))!.customFields as Record<string, unknown>)
        : {};
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        customFields: {
          ...cf,
          pendingPowerDialerEmail: { subject, body, at: new Date().toISOString() },
        },
      },
    });
    return {
      ok: false,
      message: "Email provider not configured for this workspace (set TRANSOVO_OUTBOUND_EMAIL_WEBHOOK_URL)",
    };
  }

  try {
    const res = await fetch(provider, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        to: contact.email,
        subject,
        bodyText: body,
        source: "power_dialer_disposition",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: `Email delivery failed: ${text.slice(0, 120)}` };
    }
    return { ok: true, message: "Email sent" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Email send failed",
    };
  }
}

/** M75 — one-touch email from dialer session. */
export async function sendSessionEmail(input: {
  workspaceId: string;
  sessionId: string;
  contactId: string;
  subject: string;
  body: string;
  templateId?: string;
}) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });
  if (!session) return { ok: false, message: "Session not found" };
  const result = await sendDispositionEmail({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    subject: input.subject,
    body: input.body,
    templateId: input.templateId,
  });
  if (result.ok) {
    const cf =
      (await prisma.contact.findFirst({
        where: { id: input.contactId },
        select: { customFields: true },
      }))?.customFields;
    const base = cf && typeof cf === "object" ? (cf as Record<string, unknown>) : {};
    await prisma.contact.update({
      where: { id: input.contactId },
      data: {
        customFields: {
          ...base,
          lastPowerDialerEmailAt: new Date().toISOString(),
          lastPowerDialerEmailSessionId: input.sessionId,
        },
      },
    });
  }
  return result;
}
