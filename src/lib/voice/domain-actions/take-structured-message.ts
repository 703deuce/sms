import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type TakeStructuredMessageInput = {
  workspaceId: string;
  callId?: string;
  reason: string;
  caller_name?: string;
  phone?: string;
  email?: string;
  urgency?: string;
  preferred_callback?: string;
  notes?: string;
};

export async function takeStructuredMessage(input: TakeStructuredMessageInput) {
  const prisma = getPrisma();
  const reason = input.reason.trim();
  if (!reason) throw new Error("reason required");

  const phone = input.phone?.trim() ? normalizeE164(input.phone.trim()) : "";
  const callerName = String(input.caller_name || "").trim();
  const email = input.email?.trim() || "";
  const urgency = String(input.urgency || "normal");
  const preferredCallback = String(input.preferred_callback || "");
  const notes = String(input.notes || "");

  let contactId: string | undefined;
  if (phone) {
    const parts = callerName.split(/\s+/).filter(Boolean);
    const contact = await prisma.contact.upsert({
      where: {
        workspaceId_phone: { workspaceId: input.workspaceId, phone },
      },
      create: {
        workspaceId: input.workspaceId,
        phone,
        firstName: parts[0] || null,
        lastName: parts.slice(1).join(" ") || null,
        email: email || null,
      },
      update: {
        ...(parts[0] ? { firstName: parts[0] } : {}),
        ...(parts.length > 1 ? { lastName: parts.slice(1).join(" ") } : {}),
        ...(email ? { email } : {}),
      },
    });
    contactId = contact.id;
  }

  if (input.callId) {
    const existing = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: { metadata: true },
    });
    const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
    await prisma.voiceCall
      .update({
        where: { id: input.callId },
        data: {
          outcome: "message_taken",
          contactId: contactId || undefined,
          metadata: {
            ...prevMeta,
            follow_up_required: true,
            structuredMessage: {
              callerName,
              phone,
              email,
              reason,
              urgency,
              preferredCallback,
              notes,
            },
          },
        },
      })
      .catch(() => undefined);
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      event: "voice.message_taken",
      detail: JSON.stringify({
        callerName,
        phone,
        email,
        reason,
        urgency,
        preferredCallback,
        notes,
        contactId,
        callId: input.callId,
      }),
    },
  });

  const { createCrmNoteForVoice } = await import("@/lib/voice/tools/crm-writes");
  const crm = await createCrmNoteForVoice({
    workspaceId: input.workspaceId,
    subject: `Caller message: ${reason.slice(0, 80)}`,
    body: [
      `From: ${callerName || "Unknown"}`,
      phone ? `Phone: ${phone}` : "",
      email ? `Email: ${email}` : "",
      `Urgency: ${urgency}`,
      preferredCallback ? `Callback: ${preferredCallback}` : "",
      "",
      reason,
      notes,
    ]
      .filter(Boolean)
      .join("\n"),
    phone: phone || undefined,
    email: email || undefined,
    callId: input.callId,
  }).catch((err) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  const notifyTitle =
    urgency === "high" || urgency === "urgent" ? "Urgent caller message" : "New caller message";
  const notifyBody = [callerName || "Unknown caller", phone || "", reason.slice(0, 160)]
    .filter(Boolean)
    .join(" · ");
  const notifyHref = input.callId ? `/voice/calls/${input.callId}` : "/voice/calls";

  await import("@/lib/notifications/in-app")
    .then(({ notifyWorkspace }) =>
      notifyWorkspace(input.workspaceId, {
        type: "system",
        title: notifyTitle,
        body: notifyBody,
        href: notifyHref,
      }),
    )
    .catch(() => undefined);

  return {
    ok: true,
    success: true,
    speak: "Message recorded. Someone from the team will follow up.",
    contactId,
    crm,
  };
}
