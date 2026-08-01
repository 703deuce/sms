import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function executeBuiltinVoiceAction(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  toolType: string;
  input: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const args = input.input || {};

  switch (input.toolType) {
    case "lookup_customer": {
      const phone = args.phone ? normalizeE164(String(args.phone)) : "";
      const email = args.email ? String(args.email).toLowerCase() : "";
      const contact = phone
        ? await prisma.contact.findUnique({
            where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
          })
        : email
          ? await prisma.contact.findFirst({
              where: { workspaceId: input.workspaceId, email },
            })
          : null;
      if (!contact) return { found: false };
      return {
        found: true,
        contact: {
          id: contact.id,
          phone: contact.phone,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
        },
      };
    }
    case "update_contact_tags": {
      const phone = normalizeE164(String(args.phone || ""));
      const contact = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
      });
      if (!contact) throw new Error("Contact not found");
      const addTags = Array.isArray(args.addTags) ? args.addTags.map(String) : [];
      const removeTags = Array.isArray(args.removeTags) ? args.removeTags.map(String) : [];
      for (const name of addTags) {
        const tag = await prisma.tag.upsert({
          where: { workspaceId_name: { workspaceId: input.workspaceId, name } },
          create: { workspaceId: input.workspaceId, name },
          update: {},
        });
        await prisma.contactTag.upsert({
          where: { tagId_contactId: { contactId: contact.id, tagId: tag.id } },
          create: { contactId: contact.id, tagId: tag.id },
          update: {},
        });
      }
      if (removeTags.length) {
        const tags = await prisma.tag.findMany({
          where: { workspaceId: input.workspaceId, name: { in: removeTags } },
        });
        await prisma.contactTag.deleteMany({
          where: { contactId: contact.id, tagId: { in: tags.map((t: { id: string }) => t.id) } },
        });
      }
      return { ok: true, contactId: contact.id, added: addTags, removed: removeTags };
    }
    case "create_task": {
      const title = String(args.title || "Follow-up");
      const phone = args.phone ? normalizeE164(String(args.phone)) : "";
      let contactId: string | undefined;
      if (phone) {
        const c = await prisma.contact.findUnique({
          where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
        });
        contactId = c?.id;
      }
      await prisma.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          event: "voice.task_created",
          detail: JSON.stringify({
            title,
            notes: args.notes,
            dueAt: args.dueAt,
            contactId,
            callId: input.callId,
          }),
        },
      });
      return { ok: true, title, contactId };
    }
    case "send_email": {
      const to = String(args.to || "");
      const subject = String(args.subject || "");
      const body = String(args.body || "");
      if (!to || !subject || !body) throw new Error("to, subject, body required");
      // Prefer workspace email integration if present; otherwise queue a job.
      const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
      await enqueueJob({
        jobType: "voice_send_email",
        queueName: "voice-calls",
        workspaceId: input.workspaceId,
        payload: { to, subject, body, callId: input.callId },
        idempotencyKey: `voice-email-${input.callId || "none"}-${to}-${Date.now()}`,
      });
      return { ok: true, queued: true, to, subject };
    }
    case "calendar_availability": {
      const { getAvailability } = await import("../calendar/booking");
      return await getAvailability(input.workspaceId, args);
    }
    case "book_appointment": {
      const { bookAppointment } = await import("../calendar/booking");
      return await bookAppointment(input.workspaceId, args);
    }
    case "reschedule_appointment": {
      const appointmentId = String(args.appointmentId || "");
      const newStartAt = String(args.newStartAt || "");
      if (!appointmentId || !newStartAt) throw new Error("appointmentId and newStartAt required");
      const appt = await prisma.voiceAppointment.findFirst({
        where: { id: appointmentId, workspaceId: input.workspaceId },
      });
      if (!appt) throw new Error("Appointment not found");
      if (appt.contactId) {
        const clash = await prisma.voiceAppointment.findFirst({
          where: {
            workspaceId: input.workspaceId,
            contactId: appt.contactId,
            startsAt: new Date(newStartAt),
            status: { not: "cancelled" },
            id: { not: appointmentId },
          },
        });
        if (clash) throw new Error("Duplicate booking at that time");
      }
      const durationMs =
        appt.endsAt && appt.startsAt
          ? appt.endsAt.getTime() - appt.startsAt.getTime()
          : 30 * 60 * 1000;
      const startsAt = new Date(newStartAt);
      return await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: {
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationMs),
          status: "rescheduled",
        },
      });
    }
    case "cancel_appointment": {
      const appointmentId = String(args.appointmentId || "");
      if (!appointmentId) throw new Error("appointmentId required");
      return await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: { status: "cancelled", metadata: { reason: args.reason || null } as object },
      });
    }
    case "send_sms": {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      return await sendQuickSms({
        workspaceId: input.workspaceId,
        to: String(args.to || args.phone || ""),
        body: String(args.body || ""),
      });
    }
    case "end_call": {
      if (!input.callId) throw new Error("callId required");
      const call = await prisma.voiceCall.findFirst({
        where: { id: input.callId, workspaceId: input.workspaceId },
      });
      if (call?.telnyxCallControlId) {
        const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
        await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/hangup`, {
          method: "POST",
          body: {},
        });
      }
      return { ok: true };
    }
    case "send_dtmf": {
      const digits = String(args.digits || args.digit || "");
      if (!input.callId || !digits) throw new Error("callId and digits required");
      const call = await prisma.voiceCall.findFirst({
        where: { id: input.callId, workspaceId: input.workspaceId },
      });
      if (call?.telnyxCallControlId) {
        const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
        await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/send_dtmf`, {
          method: "POST",
          body: { digits },
        });
      }
      return { ok: true, digits };
    }
    case "check_order_status": {
      // Extensible: look up from contact custom fields / integration.
      const orderId = String(args.orderId || "");
      const phone = args.phone ? normalizeE164(String(args.phone)) : "";
      const contact = phone
        ? await prisma.contact.findUnique({
            where: { workspaceId_phone: { workspaceId: input.workspaceId, phone } },
          })
        : null;
      return {
        found: Boolean(orderId || contact),
        orderId: orderId || null,
        contactId: contact?.id || null,
        status: "unknown",
        message: "Connect an order lookup integration or custom webhook tool for live status.",
      };
    }
    default:
      throw new Error(`Unsupported builtin tool: ${input.toolType}`);
  }
}
