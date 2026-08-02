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
    case "lookup_customer":
    case "search_crm_contacts": {
      const { searchCrmContactsForVoice } = await import("./crm-contact-search");
      const call = input.callId
        ? await prisma.voiceCall.findFirst({
            where: { id: input.callId, workspaceId: input.workspaceId },
            select: { isTest: true, metadata: true },
          })
        : null;
      const meta = (call?.metadata || {}) as Record<string, unknown>;
      const allowSpeakPhone = Boolean(
        call?.isTest ||
          meta.internalAssistant ||
          meta.browserTest ||
          args.internal_test === true,
      );
      const result = await searchCrmContactsForVoice({
        workspaceId: input.workspaceId,
        query: args.query ? String(args.query) : args.name ? String(args.name) : "",
        phone: args.phone ? String(args.phone) : "",
        email: args.email ? String(args.email) : "",
        matchType:
          args.match_type === "name" ||
          args.match_type === "phone" ||
          args.match_type === "email"
            ? args.match_type
            : "auto",
        limit: Number(args.limit) || 3,
        allowSpeakPhone,
      });
      // Backward-compatible shape for lookup_customer.
      if (input.toolType === "lookup_customer") {
        const first = result.matches[0];
        if (!first) return { found: false, ...result };
        return {
          found: true,
          contact: {
            id: first.safeId,
            phone: first.speakPhone || first.phone,
            firstName: first.displayName.split(" ")[0] || null,
            lastName: first.displayName.split(" ").slice(1).join(" ") || null,
            email: first.email,
            company: first.company,
          },
          ...result,
        };
      }
      return result;
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
      // Also create CRM task when a CRM is connected.
      const { createCrmTaskForVoice } = await import("./crm-writes");
      const crm = await createCrmTaskForVoice({
        workspaceId: input.workspaceId,
        title,
        notes: args.notes ? String(args.notes) : undefined,
        dueAt: args.dueAt ? String(args.dueAt) : undefined,
        phone: phone || undefined,
        callId: input.callId,
      }).catch((err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      }));
      return { ok: true, title, contactId, crm };
    }
    case "take_structured_message": {
      const reason = String(args.reason || args.message || "").trim();
      if (!reason) throw new Error("reason required");
      const phone = args.phone ? normalizeE164(String(args.phone)) : "";
      const callerName = String(args.caller_name || args.name || "").trim();
      const email = args.email ? String(args.email).trim() : "";
      const urgency = String(args.urgency || "normal");
      const preferredCallback = String(args.preferred_callback || "");
      const notes = String(args.notes || "");
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
        await prisma.voiceCall.update({
          where: { id: input.callId },
          data: {
            outcome: "message_taken",
            contactId: contactId || undefined,
            metadata: {
              ...prevMeta,
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
        }).catch(() => undefined);
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
      const { createCrmNoteForVoice } = await import("./crm-writes");
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
      return {
        ok: true,
        message: "Message saved. Tell the caller you will make sure the team receives it.",
        contactId,
        crm,
      };
    }
    case "mark_disposition": {
      const disposition = String(args.disposition || "").trim();
      if (!disposition) throw new Error("disposition required");
      if (input.callId) {
        await prisma.voiceCall.update({
          where: { id: input.callId },
          data: {
            outcome: disposition,
            leadScore:
              disposition === "lead" || disposition === "callback_requested"
                ? 60
                : undefined,
          },
        }).catch(() => undefined);
      }
      await prisma.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          event: "voice.disposition",
          detail: JSON.stringify({
            disposition,
            notes: args.notes,
            callId: input.callId,
          }),
        },
      });
      return { ok: true, disposition };
    }
    case "save_caller_info": {
      const phone = normalizeE164(String(args.phone || ""));
      if (!phone) throw new Error("phone required");
      const firstName = args.first_name ? String(args.first_name) : null;
      const lastName = args.last_name ? String(args.last_name) : null;
      const email = args.email ? String(args.email) : null;
      const company = args.company ? String(args.company) : null;
      const contact = await prisma.contact.upsert({
        where: {
          workspaceId_phone: { workspaceId: input.workspaceId, phone },
        },
        create: {
          workspaceId: input.workspaceId,
          phone,
          firstName,
          lastName,
          email,
          company,
        },
        update: {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(email ? { email } : {}),
          ...(company ? { company } : {}),
        },
      });
      if (input.callId) {
        await prisma.voiceCall
          .update({
            where: { id: input.callId },
            data: { contactId: contact.id },
          })
          .catch(() => undefined);
      }
      const { upsertCrmContactForVoice } = await import("./crm-writes");
      const crm = await upsertCrmContactForVoice({
        workspaceId: input.workspaceId,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone,
        email: email || undefined,
        company: company || undefined,
      }).catch((err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      }));
      return { ok: true, contactId: contact.id, crm };
    }
    case "create_crm_note": {
      const { createCrmNoteForVoice } = await import("./crm-writes");
      return await createCrmNoteForVoice({
        workspaceId: input.workspaceId,
        subject: args.subject ? String(args.subject) : undefined,
        body: String(args.body || ""),
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        callId: input.callId,
      });
    }
    case "create_crm_task": {
      const { createCrmTaskForVoice } = await import("./crm-writes");
      return await createCrmTaskForVoice({
        workspaceId: input.workspaceId,
        title: String(args.title || "Follow-up"),
        notes: args.notes ? String(args.notes) : undefined,
        dueAt: args.dueAt ? String(args.dueAt) : undefined,
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        callId: input.callId,
      });
    }
    case "upsert_crm_contact": {
      const { upsertCrmContactForVoice } = await import("./crm-writes");
      return await upsertCrmContactForVoice({
        workspaceId: input.workspaceId,
        firstName: args.first_name ? String(args.first_name) : undefined,
        lastName: args.last_name ? String(args.last_name) : undefined,
        phone: args.phone ? String(args.phone) : undefined,
        email: args.email ? String(args.email) : undefined,
        company: args.company ? String(args.company) : undefined,
      });
    }
    case "escalate_human":
    case "sip_refer": {
      if (!input.callId) throw new Error("callId required");
      const call = await prisma.voiceCall.findFirst({
        where: { id: input.callId, workspaceId: input.workspaceId },
      });
      if (!call) throw new Error("Call not found");
      const targetName =
        String(args.target_name || args.destination || "Agent Handoff").trim() ||
        "Agent Handoff";
      const dest =
        (await prisma.voiceTransferDestination.findFirst({
          where: {
            workspaceId: input.workspaceId,
            enabled: true,
            OR: [
              { agentId: input.agentId || undefined, name: { equals: targetName, mode: "insensitive" } },
              { agentId: null, name: { equals: targetName, mode: "insensitive" } },
              ...(input.toolType === "escalate_human"
                ? [
                    {
                      agentId: input.agentId || undefined,
                      name: { equals: "Front Desk", mode: "insensitive" as const },
                    },
                  ]
                : []),
            ],
          },
        })) ||
        (await prisma.voiceTransferDestination.findFirst({
          where: {
            workspaceId: input.workspaceId,
            agentId: input.agentId || undefined,
            enabled: true,
          },
          orderBy: { name: "asc" },
        }));
      if (!dest) {
        return {
          ok: false,
          error:
            "No transfer destination configured. Ask the caller for a callback instead.",
        };
      }
      const { initiateTransfer } = await import("../transfers");
      const result = await initiateTransfer({
        workspaceId: input.workspaceId,
        callId: call.id,
        destination: dest.destination,
        transferType:
          input.toolType === "sip_refer" || dest.destination.startsWith("sip:")
            ? "sip_refer"
            : "warm_transfer",
        summary: String(args.summary || args.reason || ""),
      });
      return {
        ok: true,
        transferredTo: dest.name,
        destination: dest.destination,
        reason: args.reason || null,
        result,
      };
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
      // Prefer Calendly Scheduling API when the workspace has Calendly connected.
      try {
        const { getConnection } = await import("@/lib/integrations/connections");
        const conn = await getConnection(input.workspaceId, "calendly");
        if (conn?.status === "connected") {
          const { executeIntegrationAction } = await import(
            "@/lib/integrations/framework/actions-registry"
          );
          const result = await executeIntegrationAction({
            workspaceId: input.workspaceId,
            provider: "calendly",
            actionId: "appointment.list_available_times",
            params: {
              eventTypeUri: args.eventTypeUri || args.eventTypeId,
              startTime: args.startTime || args.from,
              endTime: args.endTime || args.to,
            },
            contactId: (args.contactId as string) || null,
            actorUserId: null,
            source: "ai",
          });
          if (result.ok) {
            return {
              provider: "calendly",
              slots: (result.data as { slots?: unknown })?.slots || result.data,
            };
          }
        }
      } catch (err) {
        console.warn(
          "[voice] calendly availability fallback",
          err instanceof Error ? err.message : err,
        );
      }
      const { getAvailability } = await import("../calendar/booking");
      return await getAvailability(input.workspaceId, args);
    }
    case "book_appointment": {
      // Prefer Calendly POST /invitees when connected so bookings land on the
      // host calendar and fire invitee webhooks (same path as automations).
      try {
        const { getConnection } = await import("@/lib/integrations/connections");
        const conn = await getConnection(input.workspaceId, "calendly");
        if (conn?.status === "connected") {
          let email = String(args.email || "").trim();
          let name = String(args.name || args.inviteeName || "").trim();
          const phone = args.phone ? normalizeE164(String(args.phone)) : "";
          if ((!email || !name) && phone) {
            const contact = await prisma.contact.findUnique({
              where: {
                workspaceId_phone: { workspaceId: input.workspaceId, phone },
              },
            });
            if (contact) {
              email = email || contact.email || "";
              name =
                name ||
                [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                "Caller";
            }
          }
          if (!email) {
            throw new Error(
              "Calendly booking requires invitee email (pass email or a contact with email)",
            );
          }
          if (!name) name = "Caller";
          const { executeIntegrationAction } = await import(
            "@/lib/integrations/framework/actions-registry"
          );
          const result = await executeIntegrationAction({
            workspaceId: input.workspaceId,
            provider: "calendly",
            actionId: "appointment.book",
            params: {
              name,
              email,
              phone: phone || args.phone || null,
              startTime: args.startsAt || args.startTime || undefined,
              timezone: args.timezone || "America/New_York",
              eventTypeUri: args.eventTypeUri || args.eventTypeId || undefined,
            },
            contactId: (args.contactId as string) || null,
            actorUserId: null,
            source: "ai",
          });
          if (result.ok) {
            return { provider: "calendly", ok: true, ...(result.data as object) };
          }
          throw new Error(
            ("message" in result && result.message) || "Calendly book failed",
          );
        }
      } catch (err) {
        // If Calendly is connected but booking failed, surface the error rather
        // than silently booking only into the internal calendar.
        const { getConnection } = await import("@/lib/integrations/connections");
        const conn = await getConnection(input.workspaceId, "calendly").catch(
          () => null,
        );
        if (conn?.status === "connected") {
          throw err instanceof Error ? err : new Error(String(err));
        }
        console.warn(
          "[voice] calendly book skipped",
          err instanceof Error ? err.message : err,
        );
      }
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
      // Block arbitrary caller-controlled sequences outside DTMF charset/length.
      if (!/^[0-9A-D*#wW,]{1,32}$/.test(digits)) {
        throw new Error("Invalid DTMF sequence");
      }
      const call = await prisma.voiceCall.findFirst({
        where: { id: input.callId, workspaceId: input.workspaceId },
      });
      if (call?.telnyxCallControlId) {
        const { sendDtmf } = await import("@/lib/voice/telnyx/ai-client");
        await sendDtmf(call.telnyxCallControlId, digits);
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
