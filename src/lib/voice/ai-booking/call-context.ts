import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function loadVoiceCallBookingContext(input: {
  workspaceId: string;
  callId: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      id: true,
      fromE164: true,
      contactId: true,
      metadata: true,
    },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  let contactId = call?.contactId || null;
  let customerName = String(meta.callerName || meta.customer_name || "").trim();
  let customerEmail = String(meta.callerEmail || meta.customer_email || "").trim();
  let customerPhone =
    call?.fromE164 && call.fromE164 !== "unknown"
      ? normalizeE164(call.fromE164)
      : "";

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId: input.workspaceId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    });
    if (contact) {
      if (!customerName) {
        customerName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
      }
      if (!customerEmail && contact.email) customerEmail = contact.email;
      if (!customerPhone && contact.phone) customerPhone = normalizeE164(contact.phone);
    }
  }

  return {
    call,
    contactId,
    customerName: customerName || "Caller",
    customerEmail: customerEmail || null,
    customerPhone: customerPhone || null,
    metadata: meta,
  };
}

export async function nextVoiceBookingWriteEpoch(callId: string): Promise<number> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const epoch = Number(meta.voiceBookingWriteEpoch || 0) + 1;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        voiceBookingWriteEpoch: epoch,
        voiceBookingWriteEpochAt: new Date().toISOString(),
      } as object,
    },
  });
  return epoch;
}
