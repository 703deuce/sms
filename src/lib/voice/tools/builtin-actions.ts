import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveLiveAgentExecutionContext } from "./live-agent-context";

async function executeLiveAgentCalendlyAction(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  actionId: "appointment.list_available_times" | "appointment.book";
  params: Record<string, unknown>;
  contactId?: string | null;
}) {
  const liveAgent = await resolveLiveAgentExecutionContext({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });
  const { executeIntegrationAction } = await import(
    "@/lib/integrations/framework/actions-registry"
  );
  return executeIntegrationAction({
    workspaceId: input.workspaceId,
    provider: "calendly",
    actionId: input.actionId,
    params: input.params,
    contactId: input.contactId || null,
    actorUserId: null,
    source: "live_agent",
    liveAgent,
  });
}

export async function executeBuiltinVoiceAction(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  toolType: string;
  input: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  let args = input.input || {};

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
      // Prefer the search helper's relevance-aware `speak` string.
      if (input.toolType === "lookup_customer") {
        const first = result.matches[0];
        if (!first) {
          return {
            ...result,
            found: false,
            speak:
              result.speak ||
              "I couldn't find that contact. Can you spell the name or share another detail?",
          };
        }
        return {
          ...result,
          found: true,
          contact: {
            id: first.safeId,
            phone: first.speakPhone || first.phone,
            firstName: first.displayName.split(" ")[0] || null,
            lastName: first.displayName.split(" ").slice(1).join(" ") || null,
            email: first.email,
            company: first.company,
          },
          speak:
            result.speak ||
            (allowSpeakPhone
              ? `I found ${first.displayName}${first.speakPhone ? `, phone ${first.speakPhone}` : ""}.`
              : `I found ${first.displayName}. I can take a message or transfer you.`),
        };
      }
      return {
        ...result,
        speak:
          result.speak ||
          (result.matchCount === 0
            ? "I couldn't find that contact. Can you spell the name?"
            : `I found ${result.matches[0]?.displayName || "a match"}.`),
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

      const notifyTitle =
        urgency === "high" || urgency === "urgent"
          ? "Urgent caller message"
          : "New caller message";
      const notifyBody = [callerName || "Unknown caller", phone || "", reason.slice(0, 160)]
        .filter(Boolean)
        .join(" · ");
      const notifyHref = input.callId ? `/voice/calls/${input.callId}` : "/voice/calls";

      // Staff notification — required for every receptionist message-taking path.
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

      // Best-effort email via Brevo / voice_send_email when staff emails are available.
      await notifyStaffByEmail({
        workspaceId: input.workspaceId,
        subject: notifyTitle,
        body: [
          notifyBody,
          preferredCallback ? `Preferred callback: ${preferredCallback}` : "",
          notes ? `Notes: ${notes}` : "",
          notifyHref.startsWith("/")
            ? `Open: ${(process.env.APP_URL || "").replace(/\/$/, "")}${notifyHref}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        callId: input.callId,
        kind: "caller_message",
      }).catch(() => undefined);

      // High/urgent messages also create a follow-up task for the team.
      let task: unknown = null;
      if (urgency === "high" || urgency === "urgent") {
        task = await executeBuiltinVoiceAction({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          callId: input.callId,
          toolType: "create_task",
          input: {
            title: `Urgent callback: ${callerName || phone || "caller"}`,
            notes: [reason, preferredCallback ? `Callback: ${preferredCallback}` : "", notes]
              .filter(Boolean)
              .join("\n"),
            phone: phone || undefined,
          },
        }).catch((err) => ({
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        }));
      }

      return {
        ok: true,
        message: "Message saved. Tell the caller you will make sure the team receives it.",
        contactId,
        crm,
        follow_up_required: true,
        task,
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
      if (!input.callId) {
        return {
          ok: false,
          error: "callId required",
          speak:
            "I couldn't start the transfer from this session. I can take a message instead.",
        };
      }
      const call = await prisma.voiceCall.findFirst({
        where: { id: input.callId, workspaceId: input.workspaceId },
      });
      if (!call) {
        return {
          ok: false,
          error: "Call not found",
          speak: "I couldn't find the active call to transfer. Can I take a message?",
        };
      }
      if (!call.telnyxCallControlId) {
        return {
          ok: false,
          error: "Call control id missing",
          speak:
            "I'm having trouble connecting the transfer right now. Can I take a callback message?",
        };
      }
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
          speak:
            "I don't have a transfer number configured. I can take a message for the team instead.",
        };
      }
      // Transferring a caller to their own number always fails — common when
      // testing from the handoff cellphone.
      const destNorm = normalizeE164(dest.destination);
      const callerNorm = normalizeE164(call.fromE164 || "");
      if (destNorm && callerNorm && destNorm === callerNorm) {
        return {
          ok: false,
          error: "transfer_to_self",
          speak:
            "I can't transfer you to the same phone you're calling from. On a customer call this would ring your team. I can take a message instead.",
        };
      }

      // Idempotent: if a transfer is already ringing, do not dial again or
      // invite a second "failed" apology from the model.
      const inflight = await prisma.voiceTransfer.findFirst({
        where: {
          workspaceId: input.workspaceId,
          callId: call.id,
          status: {
            in: ["requested", "ringing", "bridging", "in_progress", "consulting"],
          },
        },
        orderBy: { createdAt: "desc" },
      });
      if (inflight) {
        return {
          ok: true,
          alreadyInProgress: true,
          transferId: inflight.id,
          transferredTo: dest.name,
          destination: dest.destination,
          speak: `I'm still connecting you with ${dest.name}. Please stay on the line.`,
        };
      }

      // Cold/blind Call Control transfer — single path for PSTN human handoff.
      const { loadVoiceAgentRuntimeConfigRecord } = await import("../load-agent-config");
      const agentConfig = input.agentId
        ? await loadVoiceAgentRuntimeConfigRecord(input.workspaceId, input.agentId)
        : ({} as Record<string, unknown>);
      const transfersCfg = (agentConfig.transfers || {}) as Record<string, unknown>;
      const shouldAnnounce = Boolean(transfersCfg.announce);
      const fallback = String(transfersCfg.fallback || "return_to_ai");

      if (shouldAnnounce && call.telnyxCallControlId) {
        const { speakOnCallControl } = await import("../startup-greeting-runtime");
        await speakOnCallControl(
          call.telnyxCallControlId,
          "Please hold while I connect you.",
        ).catch(() => undefined);
      }

      const { initiateTransfer } = await import("../transfers");
      try {
        const result = await initiateTransfer({
          workspaceId: input.workspaceId,
          callId: call.id,
          destination: dest.destination,
          transferType:
            input.toolType === "sip_refer" || dest.destination.startsWith("sip:")
              ? "sip_refer"
              : transfersCfg.warmTransfer
                ? "warm_transfer"
                : "cold_transfer",
          summary: String(args.summary || args.reason || ""),
          timeoutSeconds: Number(
            transfersCfg.ringSeconds || transfersCfg.timeoutSeconds || 30,
          ),
        });
        return {
          ok: true,
          transferredTo: dest.name,
          destination: dest.destination,
          reason: args.reason || null,
          result,
          transferInProgress: true,
          // Model must not invent a failure while the destination is ringing.
          speak: `Connecting you with ${dest.name} now. Please stay on the line.`,
          guidance:
            "Transfer dial started. Say you are connecting them, then stay silent. Do not claim the transfer failed unless a later tool result says ok=false.",
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[voice] escalate_human failed", message);
        const takeMessage = fallback === "take_message";
        const notifyStaff = fallback === "notify_staff";
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
                outcome: takeMessage
                  ? "transfer_failed_take_message"
                  : notifyStaff
                    ? "transfer_failed_notify_staff"
                    : "transfer_failed",
                metadata: {
                  ...prevMeta,
                  transferFailed: true,
                  transferFallback: fallback,
                  transferError: message,
                  ...(takeMessage || notifyStaff ? { follow_up_required: true } : {}),
                },
              },
            })
            .catch(() => undefined);
        }
        if (notifyStaff) {
          await import("@/lib/notifications/in-app")
            .then(({ notifyWorkspace }) =>
              notifyWorkspace(input.workspaceId, {
                type: "system",
                title: "Transfer failed — staff follow-up needed",
                body: message.slice(0, 200),
                href: input.callId ? `/voice/calls/${input.callId}` : "/voice/calls",
              }),
            )
            .catch(() => undefined);
          await notifyStaffByEmail({
            workspaceId: input.workspaceId,
            subject: "Transfer failed — staff follow-up needed",
            body: [
              "A live transfer failed.",
              message,
              input.callId ? `Call: ${input.callId}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            callId: input.callId,
          }).catch(() => undefined);
        }
        return {
          ok: false,
          error: message,
          speak: takeMessage
            ? "I wasn't able to connect that transfer. I can take a detailed message and have someone call you back."
            : notifyStaff
              ? "I wasn't able to connect that transfer. I've notified the team and someone will follow up."
              : "I wasn't able to connect that transfer. I can help another way or try again shortly.",
        };
      }
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
    case "resolve_datetime": {
      const { resolveSpokenDatetime } = await import("../calendar/resolve-datetime");
      let timezone = String(args.timezone || args.business_timezone || "").trim();
      if (!timezone && input.agentId) {
        try {
          const { loadVoiceAgentRuntimeConfigRecord } = await import("../load-agent-config");
          const cfg = await loadVoiceAgentRuntimeConfigRecord(
            input.workspaceId,
            input.agentId,
          );
          const dyn = (cfg.dynamicVariables || {}) as Record<string, unknown>;
          timezone = String(
            dyn.business_timezone || dyn.timezone || cfg.timezone || "",
          ).trim();
        } catch {
          // fall through
        }
      }
      if (!timezone) {
        try {
          const messaging = await prisma.workspaceMessagingSettings.findUnique({
            where: { workspaceId: input.workspaceId },
            select: { timezone: true },
          });
          timezone = String(messaging?.timezone || "").trim();
        } catch {
          // fall through
        }
      }
      return resolveSpokenDatetime({
        spoken: String(args.spoken || args.query || args.text || ""),
        timezone: timezone || "America/New_York",
      });
    }
    case "calendar_availability": {
      const { buildCalendlyListAvailableTimesParams } = await import(
        "../calendar/booking-args"
      );
      const calParams = buildCalendlyListAvailableTimesParams(args, { maxDays: 3 });
      args = {
        ...calParams.normalized,
        startTime: calParams.window.startTime,
        endTime: calParams.window.endTime,
        daysAhead: calParams.window.daysAhead,
      };
      const window = calParams.window;

      // Prefer Calendly Scheduling API when the workspace has Calendly connected.
      const { getConnectedCalendly, requireCalendlyIntegrationOk } = await import(
        "../calendar/calendly-voice"
      );
      const calendlyConn = await getConnectedCalendly(input.workspaceId);
      if (calendlyConn) {
        try {
          const serviceName = String(args.serviceName || args.service || "Appointment");
          const {
            assertBookingPermission,
            loadServiceBookingConfig,
            filterSlotsByNoticeAndMaxDays,
          } = await import("../calendar/booking");
          const gates = await loadServiceBookingConfig(input.workspaceId, serviceName);
          assertBookingPermission(gates.config);

          const result = await executeLiveAgentCalendlyAction({
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            callId: input.callId,
            actionId: "appointment.list_available_times",
            params: {
              eventTypeUri: calParams.eventTypeUri,
              startTime: calParams.startTime,
              endTime: calParams.endTime,
            },
            contactId: (args.contactId as string) || null,
          });
          const okResult = requireCalendlyIntegrationOk(result, "list available times");
          const calendlyData = okResult.data || {};
          const raw =
            (calendlyData as { slots?: Array<{ startsAt?: string; startTime?: string }> })
              .slots || (Array.isArray(calendlyData) ? calendlyData : []);
          const normalized = (raw as Array<{ startsAt?: string; startTime?: string }>).map(
            (s) => ({
              startsAt: String(s.startsAt || s.startTime || ""),
            }),
          );
          let slots = filterSlotsByNoticeAndMaxDays(
            normalized.filter((s) => s.startsAt),
            gates.noticeMinutes,
            gates.maxDaysAhead,
            new Date(),
            {
              sameDayCutoff: gates.config.sameDayCutoff,
              timezone: String(
                args.timezone || gates.config.timezone || "America/New_York",
              ),
            },
          );
          return {
            provider: "calendly",
            slots: slots.slice(0, 5),
            window: { startTime: window.startTime, endTime: window.endTime },
          };
        } catch (err) {
          console.warn(
            "[voice] calendly availability error",
            err instanceof Error ? err.message : err,
          );
          if (
            err instanceof Error &&
            /does not allow direct booking|minimum notice|too far ahead|Missing required/i.test(
              err.message,
            )
          ) {
            throw err;
          }
          throw err instanceof Error
            ? err
            : new Error("Calendly availability check failed");
        }
      }
      const { getAvailability } = await import("../calendar/booking");
      const availability = await getAvailability(input.workspaceId, {
        ...args,
        daysAhead: window.daysAhead,
        startTime: window.startTime,
        endTime: window.endTime,
        preferredStartMinute: window.preferredStartMinute,
        preferredEndMinute: window.preferredEndMinute,
        maxSlots: 5,
      });
      return {
        ...availability,
        slots: (availability.slots || []).slice(0, 5),
        provider: "internal",
        window: { startTime: window.startTime, endTime: window.endTime },
      };
    }    case "find_appointments": {
      const { findAppointmentsForCaller } = await import("../calendar/booking");
      const phone = normalizeE164(
        String(args.phone || args.customerPhone || args.customer_phone || ""),
      );
      const contactId = args.contactId ? String(args.contactId) : "";
      if (!phone && !contactId) {
        return {
          ok: false,
          error: "phone required",
          speak: "What phone number should I look up the appointment under?",
          appointments: [],
        };
      }
      const rows = await findAppointmentsForCaller({
        workspaceId: input.workspaceId,
        phone: phone || undefined,
        contactId: contactId || undefined,
        includePast: args.includePast === true,
        limit: Number(args.limit) || 5,
      });
      const appointments = rows.map((a) => ({
        appointmentId: a.id,
        serviceName: a.serviceName,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        timezone: a.timezone,
        status: a.status,
        staffName: a.staffName,
      }));
      if (!appointments.length) {
        return {
          ok: true,
          found: false,
          appointments: [],
          speak: "I don't see an upcoming appointment on that number. Would you like to book one?",
        };
      }
      const first = appointments[0];
      const when = new Date(first.startsAt).toLocaleString("en-US", {
        timeZone: first.timezone || "America/New_York",
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return {
        ok: true,
        found: true,
        appointments,
        speak:
          appointments.length === 1
            ? `I found your ${first.serviceName || "appointment"} on ${when}.`
            : `I found ${appointments.length} upcoming appointments. The next is ${first.serviceName || "an appointment"} on ${when}.`,
      };
    }
    case "book_appointment": {
      const { normalizeBookingToolArgs, buildCalendlyBookParams } = await import(
        "../calendar/booking-args"
      );
      args = normalizeBookingToolArgs(args);

      if (input.callId) {
        const existingForCall = await prisma.voiceAppointment.findFirst({
          where: {
            workspaceId: input.workspaceId,
            callId: input.callId,
            status: { notIn: ["cancelled", "canceled"] },
          },
          orderBy: { createdAt: "desc" },
        });
        if (existingForCall) {
          return {
            ok: true,
            success: true,
            alreadyBooked: true,
            provider: existingForCall.externalId?.startsWith("calendly:")
              ? "calendly"
              : "internal",
            appointmentId: existingForCall.id,
            startsAt: existingForCall.startsAt,
            message:
              "Appointment was already confirmed on this call. You may tell the caller their booking is confirmed.",
          };
        }
      }

      // Prefer Calendly POST /invitees when connected so bookings land on the
      // host calendar and fire invitee webhooks (same path as automations).
      const { getConnectedCalendly, requireCalendlyIntegrationOk } = await import(
        "../calendar/calendly-voice"
      );
      const calendlyConn = await getConnectedCalendly(input.workspaceId);
      if (calendlyConn) {
        try {
          const serviceName = String(args.serviceName || args.service || "Appointment");
          const {
            assertBookingPermission,
            assertRequiredFields,
            assertBookingTimingGates,
            loadServiceBookingConfig,
            findExistingBookingForCaller,
          } = await import("../calendar/booking");
          const gates = await loadServiceBookingConfig(input.workspaceId, serviceName);
          assertBookingPermission(gates.config);
          assertRequiredFields(gates.config, args);
          const startsAt = new Date(String(args.startsAt || args.startTime || ""));
          if (!Number.isNaN(startsAt.getTime())) {
            assertBookingTimingGates({
              startsAt,
              noticeMinutes: gates.noticeMinutes,
              maxDaysAhead: gates.maxDaysAhead,
              sameDayCutoff: gates.config.sameDayCutoff,
              timezone: String(
                args.timezone || gates.config.timezone || "America/New_York",
              ),
            });
          }

          let email = String(args.email || "").trim();
          let name = String(args.name || args.inviteeName || "").trim();
          const phone = args.phone ? normalizeE164(String(args.phone)) : "";
          if (!Number.isNaN(startsAt.getTime()) && phone) {
            const existing = await findExistingBookingForCaller({
              workspaceId: input.workspaceId,
              startsAt,
              serviceName,
              phone,
              contactId: args.contactId ? String(args.contactId) : undefined,
            });
            if (existing) {
              return {
                ok: true,
                success: true,
                alreadyBooked: true,
                provider: existing.externalId?.startsWith("calendly:")
                  ? "calendly"
                  : "internal",
                appointmentId: existing.id,
                startsAt: existing.startsAt,
                message:
                  "Appointment was already confirmed. You may tell the caller their booking is confirmed.",
              };
            }
          }
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
          const bookParams = buildCalendlyBookParams({
            ...args,
            name,
            email,
            phone: phone || args.phone,
          });
          const result = await executeLiveAgentCalendlyAction({
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            callId: input.callId,
            actionId: "appointment.book",
            params: {
              name: bookParams.name,
              email: bookParams.email,
              phone: bookParams.phone,
              startTime: bookParams.startTime,
              timezone: bookParams.timezone,
              eventTypeUri: bookParams.eventTypeUri,
              callId: input.callId || null,
            },
            contactId: (args.contactId as string) || null,
          });
          const okResult = requireCalendlyIntegrationOk(result, "book appointment");
          const resultData = okResult.data || {};
          const booked = {
            provider: "calendly",
            ok: true,
            ...(resultData as object),
          };
          const appointmentRow = await prisma.voiceAppointment.findFirst({
            where: {
              workspaceId: input.workspaceId,
              callId: input.callId || undefined,
              externalId: { startsWith: "calendly:" },
            },
            orderBy: { createdAt: "desc" },
          });
          await afterAppointmentBooked({
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            callId: input.callId,
            phone: phone || (args.phone ? String(args.phone) : ""),
            name,
            email,
            startsAt: String(args.startsAt || args.startTime || ""),
            serviceName,
            appointmentId:
              appointmentRow?.id ||
              (resultData as { appointmentId?: string; id?: string })?.appointmentId ||
              (resultData as { id?: string })?.id ||
              undefined,
          }).catch(() => undefined);
          return { ...booked, smsSent: true, appointmentId: appointmentRow?.id };
        } catch (err) {
          console.warn(
            "[voice] calendly book error",
            err instanceof Error ? err.message : err,
          );
          if (
            err instanceof Error &&
            /does not allow direct booking|minimum notice|too far ahead|Missing required|requires invitee email/i.test(
              err.message,
            )
          ) {
            throw err;
          }
          throw err instanceof Error
            ? err
            : new Error("Calendly booking failed");
        }
      }
      const { bookAppointment } = await import("../calendar/booking");
      const booked = await bookAppointment(input.workspaceId, {
        ...args,
        callId: input.callId || args.callId,
        agentId: input.agentId,
      });
      await afterAppointmentBooked({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        phone: args.phone ? String(args.phone) : "",
        name: String(args.name || ""),
        email: args.email ? String(args.email) : "",
        startsAt: String(args.startsAt || ""),
        serviceName: String(args.serviceName || args.service || "Appointment"),
        appointmentId:
          booked && typeof booked === "object" && "appointmentId" in booked
            ? String((booked as { appointmentId: string }).appointmentId)
            : booked &&
                typeof booked === "object" &&
                "appointment" in booked &&
                (booked as { appointment?: { id?: string } }).appointment?.id
              ? String((booked as { appointment: { id: string } }).appointment.id)
              : undefined,
        smsAlreadySent: Boolean(
          booked && typeof booked === "object" && "smsSent" in booked
            ? (booked as { smsSent?: boolean }).smsSent
            : false,
        ),
      }).catch(() => undefined);
      return booked;
    }
    case "hold_appointment_slot": {
      const { normalizeBookingToolArgs } = await import("../calendar/booking-args");
      args = normalizeBookingToolArgs(args);
      const startsAt = new Date(String(args.startsAt || ""));
      if (Number.isNaN(startsAt.getTime())) throw new Error("startsAt required");
      const serviceName = String(args.serviceName || args.service || "Appointment");
      const {
        loadServiceBookingConfig,
        assertBookingTimingGates,
      } = await import("../calendar/booking");
      const gates = await loadServiceBookingConfig(input.workspaceId, serviceName);
      const durationMinutes = Number(
        args.durationMinutes || gates.service?.durationMinutes || 30,
      );
      const endsAt = new Date(
        startsAt.getTime() + durationMinutes * 60_000,
      );
      assertBookingTimingGates({
        startsAt,
        noticeMinutes: gates.noticeMinutes,
        maxDaysAhead: gates.maxDaysAhead,
        sameDayCutoff: gates.config.sameDayCutoff,
        timezone: String(args.timezone || gates.config.timezone || "America/New_York"),
      });
      const { holdAppointmentSlot } = await import("../calendar/slot-holds");
      const hold = await holdAppointmentSlot({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        contactId: args.contactId ? String(args.contactId) : undefined,
        phone: args.phone ? String(args.phone) : undefined,
        serviceName,
        staffName: args.staffName ? String(args.staffName) : undefined,
        startsAt,
        endsAt,
        timezone: args.timezone ? String(args.timezone) : undefined,
        expiresInSeconds: Number(args.expiresInSeconds || 180),
      });
      return {
        ok: true,
        holdId: hold.id,
        startsAt: hold.startsAt,
        endsAt: hold.endsAt,
        expiresAt: hold.expiresAt,
        speak: "I've reserved that time while we finish the details.",
      };
    }
    case "release_appointment_hold": {
      const { releaseAppointmentHold } = await import("../calendar/slot-holds");
      const result = await releaseAppointmentHold({
        workspaceId: input.workspaceId,
        holdId: args.holdId ? String(args.holdId) : undefined,
        callId: input.callId || (args.callId ? String(args.callId) : undefined),
        startsAt: args.startsAt ? new Date(String(args.startsAt)) : undefined,
      });
      return {
        ok: true,
        ...result,
        speak:
          result.released > 0
            ? "I've released the reserved time."
            : "There was no active hold to release.",
      };
    }
    case "reschedule_appointment": {
      const appointmentId = String(args.appointmentId || "");
      const newStartAt = String(args.newStartAt || args.startsAt || "");
      if (!appointmentId || !newStartAt) throw new Error("appointmentId and newStartAt required");
      const appt = await prisma.voiceAppointment.findFirst({
        where: { id: appointmentId, workspaceId: input.workspaceId },
      });
      if (!appt) throw new Error("Appointment not found");
      const startsAt = new Date(newStartAt);
      if (Number.isNaN(startsAt.getTime())) throw new Error("newStartAt must be a valid ISO time");
      // Idempotent: already moved to this time.
      if (
        appt.startsAt &&
        Math.abs(appt.startsAt.getTime() - startsAt.getTime()) < 60_000 &&
        appt.status !== "cancelled"
      ) {
        return {
          ok: true,
          alreadyRescheduled: true,
          appointmentId: appt.id,
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          serviceName: appt.serviceName,
          speak: "That appointment is already at the requested time.",
        };
      }
      if (appt.contactId) {
        const clash = await prisma.voiceAppointment.findFirst({
          where: {
            workspaceId: input.workspaceId,
            contactId: appt.contactId,
            startsAt,
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
      const updated = await prisma.voiceAppointment.update({
        where: { id: appointmentId },
        data: {
          startsAt,
          endsAt: new Date(startsAt.getTime() + durationMs),
          status: "rescheduled",
        },
      });
      return {
        ok: true,
        appointmentId: updated.id,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        serviceName: updated.serviceName,
        status: updated.status,
        speak: "I've moved that appointment. Confirm the new date and time with the caller.",
      };
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
    case "start_automation": {
      // Prefer explicit automationId; fall back to agent's postCallAutomationId.
      let flowId = String(args.automationId || args.flowId || "").trim();
      if (!flowId && input.agentId) {
        const agent = await prisma.voiceAgent.findFirst({
          where: { id: input.agentId, workspaceId: input.workspaceId },
          select: { postCallAutomationId: true, linkedAutomationIds: true },
        });
        flowId =
          agent?.postCallAutomationId ||
          (agent?.linkedAutomationIds as string[] | undefined)?.[0] ||
          "";
      }
      if (!flowId) throw new Error("automationId required");
      let contactId = String(args.contactId || "");
      if (!contactId && input.callId) {
        const call = await prisma.voiceCall.findFirst({
          where: { id: input.callId, workspaceId: input.workspaceId },
          select: { contactId: true, fromE164: true },
        });
        contactId = call?.contactId || "";
        if (!contactId && call?.fromE164) {
          const c = await prisma.contact.findFirst({
            where: { workspaceId: input.workspaceId, phone: call.fromE164 },
            select: { id: true },
          });
          contactId = c?.id || "";
        }
      }
      if (!contactId) throw new Error("contactId required");
      const { enrollInAutomation } = await import("@/lib/automations/enroll");
      const result = await enrollInAutomation({
        workspaceId: input.workspaceId,
        flowId,
        contactId,
      });
      return { ok: true, flowId, contactId, result };
    }
    case "end_call": {
      // Prefer Telnyx-native hangup. Only hang up after an explicit reason that
      // indicates the conversation is finished — never after CRM/lookup failures.
      const reason = String(args.reason || "").toLowerCase();
      const blocked =
        /lookup|crm|transfer|tool|error|fail|timeout|hold|connect(ing)? you/.test(
          reason,
        );
      const allowed =
        !blocked &&
        (!reason ||
          /goodbye|complete|finished|caller.?asked|hang.?up|end.?call|conversation.?over|no further/.test(
            reason,
          ));
      if (!allowed) {
        return {
          ok: false,
          error: "end_call refused — reason does not indicate conversation end",
          speak: "Is there anything else I can help you with?",
        };
      }
      if (!input.callId) {
        return { ok: false, error: "callId required", speak: "Thanks for calling." };
      }
      const call = await prisma.voiceCall.findFirst({
        where: { id: input.callId, workspaceId: input.workspaceId },
      });
      if (call?.telnyxCallControlId) {
        const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
        await telnyxRequest(`/calls/${call.telnyxCallControlId}/actions/hangup`, {
          method: "POST",
          body: {},
        }).catch((err) => {
          console.warn(
            "[voice] end_call hangup failed",
            err instanceof Error ? err.message : err,
          );
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

async function agentSmsConfirmationsEnabled(
  workspaceId: string,
  agentId?: string,
): Promise<boolean> {
  if (!agentId) return false;
  const { loadVoiceAgentRuntimeConfigRecord } = await import("../load-agent-config");
  const cfg = await loadVoiceAgentRuntimeConfigRecord(workspaceId, agentId);
  const messaging = (cfg.messaging || {}) as Record<string, unknown>;
  if ("smsConfirmations" in messaging) return Boolean(messaging.smsConfirmations);
  const tools = Array.isArray(cfg.enabledBuiltinTools)
    ? (cfg.enabledBuiltinTools as string[])
    : [];
  return tools.includes("send_sms");
}

async function notifyStaffByEmail(input: {
  workspaceId: string;
  subject: string;
  body: string;
  callId?: string;
  kind?: string;
}) {
  const prisma = getPrisma();
  const memberships = await prisma.membership.findMany({
    where: { workspaceId: input.workspaceId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!memberships.length) return { sent: 0 };

  const { getNotificationPrefs } = await import("@/lib/settings/notification-prefs");
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  let sent = 0;
  const seen = new Set<string>();

  for (const m of memberships as Array<{
    userId: string;
    user: { id: string; email: string };
  }>) {
    const prefs = await getNotificationPrefs(input.workspaceId, m.userId).catch(() => null);
    const typePref =
      prefs?.prefs && typeof prefs.prefs === "object"
        ? (prefs.prefs as Record<string, { email?: boolean } | undefined>).system
        : undefined;
    if (typePref?.email === false) continue;

    const to = (prefs?.notifyEmail?.trim() || m.user.email || "").trim().toLowerCase();
    if (!to || seen.has(to)) continue;
    seen.add(to);

    await enqueueJob({
      jobType: "voice_send_email",
      queueName: "voice-calls",
      workspaceId: input.workspaceId,
      payload: {
        workspaceId: input.workspaceId,
        to,
        subject: input.subject,
        body: input.body,
        callId: input.callId,
        kind: input.kind || "staff_notify",
      },
      idempotencyKey: `voice-staff-email-${input.kind || "notify"}-${input.callId || "none"}-${to}-${Date.now()}`,
    }).catch(() => undefined);
    sent += 1;
  }
  return { sent };
}

async function afterAppointmentBooked(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  phone?: string;
  name?: string;
  email?: string;
  startsAt?: string;
  serviceName: string;
  appointmentId?: string;
  smsAlreadySent?: boolean;
}) {
  const when = input.startsAt || "the scheduled time";
  const body = [
    input.name || "Caller",
    input.phone || "",
    `${input.serviceName} · ${when}`,
  ]
    .filter(Boolean)
    .join(" · ");

  await import("@/lib/notifications/in-app")
    .then(({ notifyWorkspace }) =>
      notifyWorkspace(input.workspaceId, {
        type: "system",
        title: "Appointment booked",
        body,
        href: input.callId ? `/voice/calls/${input.callId}` : "/voice/calls",
      }),
    )
    .catch(() => undefined);

  if (input.callId) {
    await getPrisma()
      .voiceCall.update({
        where: { id: input.callId },
        data: { appointmentBooked: true },
      })
      .catch(() => undefined);
  }

  await notifyStaffByEmail({
    workspaceId: input.workspaceId,
    subject: `Appointment booked: ${input.serviceName}`,
    body: [
      body,
      input.email ? `Email: ${input.email}` : "",
      input.appointmentId ? `Appointment ID: ${input.appointmentId}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    callId: input.callId,
    kind: "appointment_booked",
  }).catch(() => undefined);

  if (input.smsAlreadySent) {
    const { verifyAppointmentBooking } = await import(
      "@/lib/agents/appointment-booking/verify-booking"
    );
    await verifyAppointmentBooking({
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      callId: input.callId,
      smsAlreadySent: true,
    }).catch(() => undefined);
    return;
  }
  const phone = input.phone ? normalizeE164(input.phone) : "";
  let smsSent = false;
  if (phone) {
    const smsOn = await agentSmsConfirmationsEnabled(input.workspaceId, input.agentId);
    if (smsOn) {
      const smsBody = `Your ${input.serviceName} appointment is confirmed for ${when}.`;
      try {
        const { sendQuickSms } = await import("@/lib/sms/send-quick");
        await sendQuickSms({
          workspaceId: input.workspaceId,
          to: phone,
          body: smsBody,
        });
        smsSent = true;
      } catch (err) {
        console.warn(
          "[voice] appointment SMS confirmation failed",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  const { verifyAppointmentBooking } = await import(
    "@/lib/agents/appointment-booking/verify-booking"
  );
  await verifyAppointmentBooking({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    callId: input.callId,
    smsAlreadySent: smsSent || Boolean(input.smsAlreadySent),
  }).catch(() => undefined);
}

