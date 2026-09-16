import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";
import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { probeCfnaIngress, shouldProbeCfnaPayload } from "@/lib/mctb/cfna-ingress-probe";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
    record_type?: string;
  };
};

function decodeClientState(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

function isAppointmentVoiceReminderEvent(
  clientState: Record<string, unknown>,
  eventType: string,
): boolean {
  if (clientState.kind !== "appointment_voice_reminder") return false;
  return (
    eventType === "call.answered" ||
    eventType === "call.gather.ended" ||
    eventType === "call.dtmf.received" ||
    eventType === "call.speak.ended" ||
    eventType === "call.playback.ended" ||
    eventType === "call.hangup" ||
    (eventType.includes("machine") && eventType.includes("detection"))
  );
}

export async function handleTelnyxVoiceWebhook(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const payload = verified.payload;
  const body = payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  const prisma = getPrisma();

  // Idempotency
  const existing = await prisma.providerWebhookEvent.findUnique({
    where: { providerEventId },
  });
  if (existing?.status === "processed") {
    return { ok: true, duplicate: true };
  }

  if (shouldProbeCfnaPayload(eventPayload)) {
    probeCfnaIngress({
      layer: "telnyx-voice-cc",
      eventType,
      payload: eventPayload,
      note:
        eventType === "call.initiated"
          ? "Call Control call.initiated — programmable leg created"
          : undefined,
    });
  }

  const clientState = decodeClientState(
    eventPayload.client_state as string | undefined,
  );
  const workspaceId = clientState.workspaceId as string | undefined;
  const callId = clientState.callId as string | undefined;
  const humanCallId = clientState.humanCallId as string | undefined;
  const isHuman = clientState.kind === "human" || Boolean(humanCallId);

  await prisma.providerWebhookEvent.upsert({
    where: { providerEventId },
    create: {
      workspaceId,
      provider: "telnyx",
      eventType,
      providerEventId,
      payload: body as object,
      status: "received",
    },
    update: {
      payload: body as object,
    },
  });

  const jobPayload = {
    providerEventId,
    eventType,
    workspaceId,
    callId,
    humanCallId,
    isHuman,
    eventPayload,
  } as Prisma.InputJsonValue;

  // Forwarded PSTN legs often drop in 1–2s unless we answer immediately — do not queue.
  if (eventType === "call.initiated") {
    const result = await processVoiceWebhookEvent({
      providerEventId,
      eventType,
      workspaceId,
      callId,
      humanCallId,
      isHuman,
      eventPayload,
    });
    return { ...result, eventType, providerEventId, processed: "sync" as const };
  }

  // Appointment voice reminders must play TTS promptly after answer — process synchronously.
  if (isAppointmentVoiceReminderEvent(clientState, eventType)) {
    const result = await processVoiceWebhookEvent({
      providerEventId,
      eventType,
      workspaceId,
      callId,
      humanCallId,
      isHuman,
      eventPayload,
    });
    return { ...result, eventType, providerEventId, processed: "sync" as const };
  }

  // Fast ACK — other voice events processed in background job
  await enqueueJob({
    jobType: "voice_webhook_process",
    queueName: "voice-calls",
    payload: jobPayload,
    idempotencyKey: `voice-webhook:${providerEventId}`,
  });

  return { ok: true, eventType, providerEventId };
}

export async function processVoiceWebhookEvent(input: {
  providerEventId: string;
  eventType: string;
  workspaceId?: string;
  callId?: string;
  humanCallId?: string;
  isHuman?: boolean;
  eventPayload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const { eventType, callId, humanCallId, isHuman, eventPayload } = input;

  const { processCallerIdVerificationWebhook } = await import(
    "@/lib/smart-routing/caller-id-verification"
  );
  const callerIdEvent = await processCallerIdVerificationWebhook({
    eventType,
    eventPayload,
  });
  if (callerIdEvent.handled) {
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "processed", processedAt: new Date() },
    });
    return { ok: true, kind: "caller_id_verification" };
  }

  const { processAppointmentVoiceReminderWebhook } = await import(
    "@/lib/appointment-voice-reminders/runtime"
  );
  const voiceReminderEvent = await processAppointmentVoiceReminderWebhook({
    eventType,
    eventPayload,
  });
  if (voiceReminderEvent.handled) {
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "processed", processedAt: new Date() },
    });
    return { ok: true, kind: "appointment_voice_reminder" };
  }

  // Softphone call screening gather (accept / voicemail).
  if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
    const screeningState = (() => {
      const raw = eventPayload.client_state;
      if (typeof raw !== "string") return {};
      try {
        return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    if (screeningState.kind === "call_screening" || screeningState.kind === "personal_call_screening") {
      // Screening gather / answer can arrive as gather.ended on the agent leg,
      // or as call.answered when the agent phone picks up (handled below via human webhook).
      const digit = String(eventPayload.digits || eventPayload.digit || "").trim();
      const agentControlId = String(eventPayload.call_control_id || "");
      const humanCallId = String(screeningState.humanCallId || "");
      const parentId = String(screeningState.parentCallControlId || "");
      const workspaceId = String(screeningState.workspaceId || input.workspaceId || "");

      if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
        if (digit !== "1" && humanCallId && parentId) {
          if (screeningState.kind === "personal_call_screening") {
            const callRow = await prisma.humanCall.findUnique({ where: { id: humanCallId } });
            const { tagForwardOutcome } = await import("@/lib/numbers/forward-call-outcomes");
            await tagForwardOutcome(
              humanCallId,
              digit ? "SCREENING_REJECTED" : "SCREENING_TIMEOUT",
            );
            const { applyPersonalForwardOverflow } = await import(
              "@/lib/numbers/personal-forward-fallback"
            );
            await applyPersonalForwardOverflow({
              workspaceId,
              humanCallId,
              telnyxCallControlId: parentId,
              toE164: callRow?.to || "",
              reason: "unanswered",
            }).catch(() => undefined);
          } else {
            const { leaveVoicemailOnCall } = await import("@/lib/phone/voicemail-service");
            await leaveVoicemailOnCall({
              workspaceId,
              humanCallId,
              telnyxCallControlId: parentId,
              userId: screeningState.userId ? String(screeningState.userId) : null,
            }).catch(() => undefined);
          }
          if (agentControlId) {
            const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
            await telnyxRequest(`/calls/${agentControlId}/actions/hangup`, {
              method: "POST",
              body: {},
            }).catch(() => undefined);
          }
        } else if (digit === "1" && humanCallId && parentId && agentControlId) {
          const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
          const { tagForwardOutcome } = await import("@/lib/numbers/forward-call-outcomes");
          await telnyxRequest(`/calls/${parentId}/actions/unhold`, {
            method: "POST",
            body: {},
          }).catch(() => undefined);
          await telnyxRequest(`/calls/${parentId}/actions/bridge`, {
            method: "POST",
            body: { call_control_id: agentControlId },
          }).catch(() => undefined);
          await tagForwardOutcome(humanCallId, "FORWARDED_ANSWERED");
          await prisma.humanCall.update({
            where: { id: humanCallId },
            data: {
              status: "in_progress",
              onHold: false,
              answeredAt: new Date(),
              notes: "screening:accepted",
            },
          }).catch(() => undefined);
        }
        await prisma.providerWebhookEvent.update({
          where: { providerEventId: input.providerEventId },
          data: { status: "processed", processedAt: new Date() },
        });
        return { ok: true, kind: "call_screening", digit };
      }
    }
  }

  if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
    const { processCallForwardingWebhookEvent } = await import(
      "@/lib/call-forwarding/webhook-handler"
    );
    const cfLeg = await processCallForwardingWebhookEvent({
      eventType,
      eventPayload,
    });
    if (cfLeg.handled) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return { ok: true, kind: "call_forwarding_webhook", detail: cfLeg.kind };
    }

    const { processSmartRoutingWebhookEvent } = await import(
      "@/lib/smart-routing/webhook-handler"
    );
    const srGather = await processSmartRoutingWebhookEvent({
      eventType,
      eventPayload,
    }).catch(() => ({ handled: false as const }));
    if (srGather.handled) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return { ok: true, kind: "smart_routing", ...srGather };
    }
  }

  if (
    eventType === "call.answered" ||
    eventType === "call.hangup" ||
    eventType === "call.recording.saved"
  ) {
    const { processCallForwardingWebhookEvent } = await import(
      "@/lib/call-forwarding/webhook-handler"
    );
    const cfEvent = await processCallForwardingWebhookEvent({
      eventType,
      eventPayload,
    }).catch(() => ({ handled: false as const }));
    if (cfEvent.handled) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return { ok: true, kind: "call_forwarding_webhook", detail: cfEvent.kind };
    }

    const { processSmartRoutingWebhookEvent } = await import(
      "@/lib/smart-routing/webhook-handler"
    );
    const srEvent = await processSmartRoutingWebhookEvent({
      eventType,
      eventPayload,
    }).catch(() => ({ handled: false as const }));
    if (srEvent.handled) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return { ok: true, kind: "smart_routing", ...srEvent };
    }
  }

  // IVR keypad selection — route the caller to their chosen option.
  if (eventType === "call.gather.ended" || eventType === "call.dtmf.received") {
    const { handleIvrGatherEnded } = await import("@/lib/phone/ivr-service");
    const ivrResult = await handleIvrGatherEnded(eventPayload).catch(() => ({
      handled: false as const,
    }));
    if (ivrResult.handled) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return { ok: true, kind: "ivr", ...ivrResult };
    }
  }

  // Human agent softphone calls
  if (isHuman || humanCallId) {
    const { processHumanCallWebhookEvent } = await import("@/lib/phone/human-call-service");
    const humanResult = await processHumanCallWebhookEvent({
      eventType,
      humanCallId,
      eventPayload,
    });
    if (humanResult.ok) {
      await prisma.providerWebhookEvent.update({
        where: { providerEventId: input.providerEventId },
        data: { status: "processed", processedAt: new Date() },
      });
      return humanResult;
    }
  }

  let humanCall = humanCallId
    ? await prisma.humanCall.findUnique({ where: { id: humanCallId } })
    : null;
  if (!humanCall && eventPayload.call_control_id) {
    humanCall = await prisma.humanCall.findFirst({
      where: { telnyxCallControlId: String(eventPayload.call_control_id) },
    });
  }
  if (humanCall) {
    const { processHumanCallWebhookEvent } = await import("@/lib/phone/human-call-service");
    const humanResult = await processHumanCallWebhookEvent({
      eventType,
      humanCallId: humanCall.id,
      eventPayload,
    });
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "processed", processedAt: new Date() },
    });
    return humanResult;
  }

  let call = callId
    ? await prisma.voiceCall.findUnique({ where: { id: callId } })
    : null;

  if (!call && eventPayload.call_control_id) {
    call = await prisma.voiceCall.findFirst({
      where: { telnyxCallControlId: String(eventPayload.call_control_id) },
    });
  }

  // Inbound routing must run before ensureVoiceCall on call.initiated — creating a
  // VoiceCall row first skips Smart Routing and falls through to MCTB on hangup.
  // TeXML status callbacks may create VoiceCall early, so Smart Routing is attempted
  // whenever the DID has an active flow (not only when !call).
  if (eventType === "call.initiated") {
    const to = String(eventPayload.to || "");
    const from = String(eventPayload.from || "");
    const callControlId = String(eventPayload.call_control_id || "");
    const pn = await prisma.phoneNumber.findFirst({
      where: { e164: to, releasedAt: null, status: { not: "Released" } },
    });
    if (pn && callControlId) {
      const forwardedFrom = parseTelnyxForwardedFrom(eventPayload);
      const { resolveSmartRoutingIngress } = await import(
        "@/lib/smart-routing/ingress-router"
      );
      const ingress = await resolveSmartRoutingIngress({
        workspaceId: pn.workspaceId,
        phoneNumberId: pn.id,
        calledE164: to,
      });

      if (ingress.kind === "employee_callback") {
        const { shouldStartEmployeeAccess } = await import(
          "@/lib/smart-routing/access-detection"
        );
        const { rejectUnauthorizedCallbackCaller, tryStartEmployeeAccess } = await import(
          "@/lib/smart-routing/employee-access-runtime"
        );
        const employeeCheck = await shouldStartEmployeeAccess({
          workspaceId: pn.workspaceId,
          callerE164: from,
        });
        if (!employeeCheck.start) {
          await rejectUnauthorizedCallbackCaller(callControlId).catch((err) => {
            console.error("[voice/webhook] rejectUnauthorizedCallbackCaller", err);
          });
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return { ok: true, kind: "smart_routing_callback_rejected" };
        }
        const ea = await tryStartEmployeeAccess({
          workspaceId: pn.workspaceId,
          callerE164: from,
          calledE164: to,
          callControlId,
          authorizedCallerId: employeeCheck.caller!.id,
          authorizedCallerName: employeeCheck.caller!.name,
        }).catch((err) => {
          console.error("[voice/webhook] tryStartEmployeeAccess", err);
          return { started: false as const };
        });
        if (ea.started) {
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return {
            ok: true,
            kind: "smart_routing_employee_access",
            accessSessionId: ea.accessSessionId,
            ingress: "callback_number",
          };
        }
      }

      if (ingress.kind === "inbound_routing") {
        const { hasActiveCallForwardingOnNumber } = await import("@/lib/call-forwarding/service");
        const cfActive = await hasActiveCallForwardingOnNumber(pn.workspaceId, pn.id);
        if (cfActive) {
          const { processSoftphoneInbound } = await import("@/lib/phone/inbound-runtime");
          await processSoftphoneInbound({
            workspaceId: pn.workspaceId,
            fromE164: from,
            toE164: to,
            telnyxCallControlId: callControlId,
          });
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return { ok: true, kind: "call_forwarding" };
        }

        const { tryStartSmartRoutingInbound } = await import(
          "@/lib/smart-routing/webhook-handler"
        );
        const sr = await tryStartSmartRoutingInbound({
          workspaceId: pn.workspaceId,
          phoneNumberId: pn.id,
          fromE164: from,
          toE164: to,
          callControlId,
          forwardedFrom,
        }).catch((err) => {
          console.error("[voice/webhook] tryStartSmartRoutingInbound", err);
          return { started: false as const };
        });
        if (sr.started) {
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return {
            ok: true,
            kind: "smart_routing",
            sessionId: sr.sessionId,
            duplicate: "duplicate" in sr ? sr.duplicate : undefined,
            ingress: ingress.kind === "inbound_routing" ? "routing_number" : undefined,
          };
        }
      }

      if (!call) {
        const { hasActiveCallForwardingOnNumber } = await import("@/lib/call-forwarding/service");
        const cfActive = await hasActiveCallForwardingOnNumber(pn.workspaceId, pn.id);
        if (cfActive && callControlId) {
          const { processSoftphoneInbound } = await import("@/lib/phone/inbound-runtime");
          await processSoftphoneInbound({
            workspaceId: pn.workspaceId,
            fromE164: from,
            toE164: to,
            telnyxCallControlId: callControlId,
          });
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return { ok: true, kind: "call_forwarding" };
        }

        const { resolveIvrForNumber, startIvrGather } = await import("@/lib/phone/ivr-service");
        const ivr = await resolveIvrForNumber(pn.workspaceId, to);
        if (ivr) {
          await startIvrGather(callControlId, ivr).catch(() => undefined);
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return { ok: true, kind: "ivr_gather" };
        }

        const workspace = await prisma.workspace.findUnique({
          where: { id: pn.workspaceId },
          select: { type: true },
        });
        const isPersonalWorkspace = workspace?.type === "PERSONAL";

        // Personal product: voicemail / forwarding / smart routing — not AI receptionist.
        if (isPersonalWorkspace) {
          const { processSoftphoneInbound } = await import("@/lib/phone/inbound-runtime");
          await processSoftphoneInbound({
            workspaceId: pn.workspaceId,
            fromE164: from,
            toE164: to,
            telnyxCallControlId: callControlId,
          });
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return { ok: true, kind: "softphone_inbound" };
        }

        const { resolveInboundAiAgent } = await import("../agent-phone");
        const aiAgent = await resolveInboundAiAgent(pn.workspaceId, pn.id);

        if (aiAgent) {
          const { handleInboundCallEvent } = await import("../inbound");
          const result = await handleInboundCallEvent({
            workspaceId: pn.workspaceId,
            fromE164: from,
            toE164: to,
            telnyxCallControlId: callControlId,
            payload: eventPayload,
          });
          call = await prisma.voiceCall.findUnique({ where: { id: result.callId } });
        } else {
          const { processSoftphoneInbound } = await import("@/lib/phone/inbound-runtime");
          await processSoftphoneInbound({
            workspaceId: pn.workspaceId,
            fromE164: from,
            toE164: to,
            telnyxCallControlId: callControlId,
          });
          await prisma.providerWebhookEvent.update({
            where: { providerEventId: input.providerEventId },
            data: { status: "processed", processedAt: new Date() },
          });
          return { ok: true, kind: "softphone_inbound" };
        }
      }
    }
  }

  // TeXML / AI assistant path: conversation START events may arrive without a prior
  // Call Control call.initiated. Create VoiceCall + enroll execution early so tools,
  // transcripts, and traces bind to one canonical call id for the whole conversation.
  // Do NOT create on conversation.ended — that caused hangup-only rows with no tool trace.
  // call.initiated is handled above (Smart Routing / IVR / AI / softphone) first.
  if (
    !call &&
    (eventType === "call.conversation.created" ||
      eventType === "conversation.created" ||
      eventType === "conversation.started" ||
      eventType === "call.answered")
  ) {
    const { ensureVoiceCallForTelnyxEvent } = await import(
      "@/lib/voice/ensure-call-from-event"
    );
    const ensured = await ensureVoiceCallForTelnyxEvent({
      eventType,
      eventPayload,
    }).catch((err) => {
      console.error("[voice/webhook] ensureVoiceCallForTelnyxEvent", err);
      return null;
    });
    if (ensured?.callId) {
      call = await prisma.voiceCall.findUnique({ where: { id: ensured.callId } });
    }
  }

  // Warm transfer consult / outbound probe client_state (decoded early).
  const clientStateRaw = eventPayload.client_state;
  let warmState: Record<string, unknown> = {};
  if (typeof clientStateRaw === "string") {
    try {
      warmState = JSON.parse(Buffer.from(clientStateRaw, "base64").toString("utf8"));
    } catch {
      warmState = {};
    }
  }

  // Direct outbound diagnostic dial (no VoiceCall row) — answer, speak, hang up.
  if (warmState.kind === "outbound_voice_probe") {
    const { handleOutboundVoiceProbeEvent } = await import(
      "@/lib/phone/telnyx-outbound-voice"
    );
    await handleOutboundVoiceProbeEvent({
      eventType,
      eventPayload,
      clientState: warmState,
    });
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "processed", processedAt: new Date() },
    });
    return { ok: true, kind: "outbound_voice_probe" };
  }

  if (!call) {
    await prisma.providerWebhookEvent.update({
      where: { providerEventId: input.providerEventId },
      data: { status: "ignored", processedAt: new Date() },
    });
    return { ok: false, reason: "call_not_found" };
  }

  const workspaceId = call.workspaceId;
  if (
    warmState.kind === "warm_transfer_consult" &&
    eventType === "call.answered" &&
    warmState.transferId &&
    warmState.callerControlId
  ) {
    const { handleWarmTransferConsultAnswered } = await import("../transfers");
    await handleWarmTransferConsultAnswered({
      workspaceId,
      callId: String(warmState.callId || call.id),
      transferId: String(warmState.transferId),
      consultControlId: String(eventPayload.call_control_id || ""),
      callerControlId: String(warmState.callerControlId),
      summary: warmState.summary ? String(warmState.summary) : undefined,
    }).catch((err) => console.warn("[voice/webhook] warm transfer consult failed", err));
  }

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId,
      callId: call.id,
      eventType,
      providerEventId: input.providerEventId,
      payload: eventPayload as object,
    },
  });

  // Connection greeting plays under AI init. When the assistant conversation is
  // ready, stop the bed so AI speech does not overlap the prerecorded file.
  if (
    eventType === "call.conversation.created" ||
    eventType === "conversation.created"
  ) {
    const controlId = String(eventPayload.call_control_id || call.telnyxCallControlId || "");
    if (controlId) {
      const { stopPlaybackOnCall } = await import("../startup-greeting-runtime");
      await stopPlaybackOnCall(controlId);
      await prisma.voiceCallEvent
        .create({
          data: {
            workspaceId,
            callId: call.id,
            eventType: "media.connection_greeting_stopped",
            payload: {
              reason: eventType,
              at: Date.now(),
            } as object,
          },
        })
        .catch(() => undefined);
    }
  }

  // Secondary legs (warm consult, etc.) must not overwrite the parent VoiceCall
  // control id or mark the live AI/customer call completed on consult hangup.
  const isSecondaryVoiceLeg = warmState.kind === "warm_transfer_consult";

  const statusMap: Record<string, string> = {
    "call.initiated": "INITIATED",
    "call.ringing": "RINGING",
    "call.answered": "ANSWERED",
    "call.bridged": "IN_PROGRESS",
    "call.hangup": "COMPLETED",
    "call.machine.detection.ended": "VOICEMAIL",
    "call.machine.premium.detection.ended": "VOICEMAIL",
    // recording.saved / transcription.completed must NOT end a live AI call.
  };

  let nextStatus = isSecondaryVoiceLeg ? undefined : statusMap[eventType];
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  // On hangup, refine COMPLETED into a missed-call status when the call was
  // never answered, based on the provider hangup cause.
  if (
    !isSecondaryVoiceLeg &&
    eventType === "call.hangup" &&
    !call.answeredAt &&
    !call.voicemailDetected
  ) {
    const cause = String(
      eventPayload.hangup_cause || eventPayload.sip_hangup_cause || "",
    ).toLowerCase();
    if (cause.includes("busy")) {
      nextStatus = "BUSY";
      patch.outcome = "busy";
    } else if (cause.includes("cancel") || cause.includes("rejected")) {
      nextStatus = "CANCELLED";
      patch.outcome = "cancelled";
    } else if (
      cause.includes("no_answer") ||
      cause.includes("no-answer") ||
      cause.includes("noanswer") ||
      cause.includes("timeout") ||
      cause.includes("no_user_response") ||
      cause === ""
    ) {
      nextStatus = "NO_ANSWER";
      patch.outcome = "no_answer";
    }
  }

  if (nextStatus) {
    patch.status = nextStatus;
    if (nextStatus === "ANSWERED" || nextStatus === "IN_PROGRESS") {
      patch.answeredAt = new Date();
    }
    if (
      nextStatus === "COMPLETED" ||
      nextStatus === "VOICEMAIL" ||
      nextStatus === "NO_ANSWER" ||
      nextStatus === "BUSY" ||
      nextStatus === "CANCELLED"
    ) {
      patch.endedAt = new Date();
    }
  }

  if (!isSecondaryVoiceLeg && eventType.includes("machine") && eventType.includes("detection")) {
    patch.voicemailDetected = true;
    patch.outcome = "voicemail";
    if (call.campaignId) {
      const { applyVoicemailPolicy } = await import("../campaigns");
      await applyVoicemailPolicy(workspaceId, call.id, call.campaignId);
    }
    const amd = String(eventPayload.result || eventPayload.machine_detection_result || "");
    if (amd) {
      const { handleTransferAmdResult } = await import("../transfers");
      await handleTransferAmdResult(call.id, workspaceId, amd);
    }
  }

  // Never replace the customer/AI control id with a consult/secondary leg id.
  if (eventPayload.call_control_id && !isSecondaryVoiceLeg) {
    patch.telnyxCallControlId = String(eventPayload.call_control_id);
  }

  if (Object.keys(patch).length > 1 || nextStatus) {
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: patch,
    });
  }

  // Call Control human transfer completed — destination answered / bridged.
  if (!isSecondaryVoiceLeg && eventType === "call.bridged") {
    const { completeTransfersOnBridge } = await import("../transfers");
    await completeTransfersOnBridge({
      workspaceId,
      callId: call.id,
    }).catch((err) =>
      console.warn("[voice/webhook] completeTransfersOnBridge failed", err),
    );
  }

  // Outbound (or inbound that never claimed): start assistant once on answered.
  // Inbound AI usually claims + starts on call.initiated — do NOT greet twice.
  // Never restart AI after a human transfer is in progress or bridged.
  if (
    !isSecondaryVoiceLeg &&
    (eventType === "call.answered" || eventType === "call.bridged") &&
    call.agentId &&
    !call.voicemailDetected
  ) {
    const { claimAiStart, isAiStartClaimed } = await import("../ai-start-lock");
    const meta = (call.metadata || {}) as Record<string, unknown>;
    if (eventType === "call.bridged" || meta.transferInProgress || call.transferred) {
      await prisma.voiceCallEvent
        .create({
          data: {
            workspaceId,
            callId: call.id,
            eventType: "media.ai_start_skipped",
            payload: {
              reason: "human_transfer_active",
              path: "answered_webhook",
              eventType,
            } as object,
          },
        })
        .catch(() => undefined);
    } else if (isAiStartClaimed(meta)) {
      await prisma.voiceCallEvent
        .create({
          data: {
            workspaceId,
            callId: call.id,
            eventType: "media.ai_start_skipped",
            payload: {
              reason: meta.aiStarted ? "ai_already_started" : "ai_start_claimed",
              path: "answered_webhook",
              eventType,
            } as object,
          },
        })
        .catch(() => undefined);
    } else {
      const claim = await claimAiStart(call.id);
      if (!claim.claimed) {
        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId,
              callId: call.id,
              eventType: "media.ai_start_skipped",
              payload: {
                reason: claim.reason || "claim_failed",
                path: "answered_webhook",
              } as object,
            },
          })
          .catch(() => undefined);
      } else {
      const agent = await prisma.voiceAgent.findUnique({ where: { id: call.agentId } });
      const controlId = String(eventPayload.call_control_id || call.telnyxCallControlId || "");
      if (agent?.telnyxAssistantId && controlId) {
        const { loadVoiceAgentRuntimeConfig } = await import("../load-agent-config");
        const { usesTexmlDirectInbound } = await import("../telnyx/texml-direct-route");
        const cfgPeek = await loadVoiceAgentRuntimeConfig(workspaceId, agent.id);
        if (usesTexmlDirectInbound(cfgPeek)) {
          await prisma.voiceCallEvent
            .create({
              data: {
                workspaceId,
                callId: call.id,
                eventType: "media.ai_start_skipped",
                payload: {
                  reason: "texml_direct_inbound",
                  path: "answered_webhook",
                  eventType,
                } as object,
              },
            })
            .catch(() => undefined);
        } else {
        const { assertAiCallAdmission } = await import("../platform/admission");
        const admission = await assertAiCallAdmission({
          workspaceId,
          agentId: agent.id,
          direction: call.direction === "OUTBOUND" ? "OUTBOUND" : "INBOUND",
          callId: call.id,
        });
        if (!admission.ok) {
          await prisma.voiceCall.update({
            where: { id: call.id },
            data: {
              metadata: {
                ...claim.meta,
                aiStartBlocked: admission.code,
                aiStartBlockedReason: admission.reason,
              } as object,
            },
          });
        } else {
        const {
          startAiAssistantOnCall,
          startCallRecording,
          startCallTranscription,
        } = await import("../telnyx/assistant-sync");
        const { resolveCallDynamicVariables } = await import("../dynamic-variables");
        const { recordFailureDiagnostic } = await import("../platform/ai-platform");
        const { playStartupGreetingMask } = await import("../startup-greeting-runtime");
        const {
          AI_MEDIA_SETTLE_MS,
          DEFAULT_AI_GREETING,
          startupGreetingFromConfig,
        } = await import("../startup-greeting");
        const {
          buildPstnAudioDiagnostics,
          normalizeOutputGainDb,
          startInboundNoiseSuppression,
        } = await import("../pstn-audio");

        const { loadVoiceAgentRuntimeConfig: loadCfg } = await import(
          "../load-agent-config"
        );
        const cfg = await loadCfg(workspaceId, agent.id);
        const startup = startupGreetingFromConfig(cfg);
        const outputGainDb = normalizeOutputGainDb(cfg.voiceLanguage?.outputGainDb);

        await startInboundNoiseSuppression(controlId);

        const concurrentMask =
          startup.enabled &&
          startup.mode === "audio_url" &&
          Boolean(startup.audioUrl) &&
          (startup.connectionGreeting === "transovo_default" ||
            (typeof startup.delayMs === "number" && startup.delayMs <= 1000));

        const maskResult = await playStartupGreetingMask({
          workspaceId,
          callId: call.id,
          callControlId: controlId,
          config: cfg,
          wait: concurrentMask ? false : undefined,
        });
        if (startup.mode === "ai" || startup.mode === "none" || !maskResult.played) {
          await new Promise((r) => setTimeout(r, AI_MEDIA_SETTLE_MS));
        } else if (concurrentMask || maskResult.concurrent) {
          const settleMs =
            typeof startup.delayMs === "number" ? startup.delayMs : 500;
          await new Promise((r) =>
            setTimeout(r, Math.max(0, Math.min(1000, settleMs))),
          );
        }

        const storedVars = (call.dynamicVariables || {}) as Record<string, unknown>;
        const dynamicVariables = await resolveCallDynamicVariables({
          workspaceId,
          agentId: agent.id,
          callId: call.id,
          contactId: call.contactId,
          fromE164: call.fromE164,
          toE164: call.toE164,
          direction: call.direction,
          overrides: storedVars,
        });
        dynamicVariables.output_gain_db = String(outputGainDb);

        const speaksFirst =
          String(cfg.callHandling?.speaksFirst || "ai").toLowerCase() === "caller"
            ? "caller"
            : "ai";
        const greeting =
          speaksFirst === "caller"
            ? null
            : (cfg.callHandling?.greeting as string | undefined)?.trim() ||
              DEFAULT_AI_GREETING;

        const aiHandoffAt = Date.now();
        let aiStartOk = false;
        try {
          await startAiAssistantOnCall({
            callControlId: controlId,
            assistantId: agent.telnyxAssistantId,
            greeting: greeting || undefined,
            dynamicVariables,
            clientState: {
              workspaceId,
              callId: call.id,
              agentId: agent.id,
              connectionGreetingPlaying: Boolean(concurrentMask || maskResult.concurrent),
            },
          });
          aiStartOk = true;
        } catch (err) {
          console.error("[voice/webhook] ai_assistant_start", err);
          await recordFailureDiagnostic({
            workspaceId,
            agentId: agent.id,
            callId: call.id,
            category: "runtime",
            code: "ai_assistant_start_failed",
            message: err instanceof Error ? err.message : String(err),
          }).catch(() => undefined);
          const { handleAiAssistantStartFailure } = await import("../inbound");
          await handleAiAssistantStartFailure({
            workspaceId,
            callId: call.id,
            telnyxCallControlId: controlId,
            fromE164: call.fromE164,
            error: err,
          });
        }

        if (aiStartOk) {
        const assistantStartReturnedAt = Date.now();
        const { scheduleVoiceV2CallWarmup } = await import("@/lib/voice-v2/call-warmup");
        scheduleVoiceV2CallWarmup({
          workspaceId,
          agentId: agent.id,
          callId: call.id,
          callControlId: controlId,
          fromE164: call.fromE164,
          conversationId: call.telnyxConversationId,
          agentConfig: cfg,
          assistantStartReturnedAt,
          warmupScheduledAt: Date.now(),
        });

        const pstnDiag = buildPstnAudioDiagnostics({
          callControlId: controlId,
          outputGainDb,
          startupGreetingMode: startup.mode,
          noiseSuppressionInbound: true,
        });

        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId,
              callId: call.id,
              eventType: "media.ai_assistant_start",
              payload: {
                at: aiHandoffAt,
                ASSISTANT_START_RETURNED_AT: assistantStartReturnedAt,
                startupMask: maskResult,
                greetingPreview: (greeting || "").slice(0, 160),
                speaksFirst,
                transcodesEstimate: 1,
                path: "answered_webhook",
                pstnAudio: pstnDiag,
              } as object,
            },
          })
          .catch(() => undefined);
        const { shouldStartCallRecording } = await import("../inbound");
        const recordingDirection =
          call.direction === "OUTBOUND" ? "OUTBOUND" : "INBOUND";
        if (shouldStartCallRecording(cfg.callHandling?.callRecording, recordingDirection)) {
          void startCallRecording(controlId);
        }
        void startCallTranscription(controlId);
        const { resolveAiVersionStamp } = await import("../platform/admission");
        const versionStamp = await resolveAiVersionStamp({
          workspaceId,
          agentId: agent.id,
          publishedVersionId: agent.publishedVersionId,
        });
        await prisma.voiceCall.update({
          where: { id: call.id },
          data: {
            agentVersionId: versionStamp.agentVersionId || call.agentVersionId,
            dynamicVariables: dynamicVariables as object,
            metadata: {
              ...claim.meta,
              aiStarted: true,
              aiStartClaimed: true,
              assistantId: agent.telnyxAssistantId,
              transcriptionStarted: true,
              assistantVersionId: versionStamp.assistantVersionId,
              canaryVersionId: versionStamp.canaryVersionId,
              canaryActive: versionStamp.canaryActive,
              mediaPipeline: {
                aiHandoffAt,
                startupMask: maskResult,
                settleMs: AI_MEDIA_SETTLE_MS,
                greetingPreview: (greeting || "").slice(0, 160),
                speaksFirst,
                path: "answered_webhook",
                transcodesEstimate: 1,
              },
              pstnAudio: pstnDiag,
            } as object,
          },
        });
        }
        }
        }
      }
      }
    }
  }

  if (
    !isSecondaryVoiceLeg &&
    (eventType === "call.hangup" ||
      eventType === "call.machine.detection.ended" ||
      eventType === "call.conversation.ended" ||
      eventType === "assistant.conversation.ended")
  ) {
    // Ensure endedAt is set for conversation-end events (TeXML may not send hangup).
    if (
      (eventType === "call.conversation.ended" ||
        eventType === "assistant.conversation.ended") &&
      !call.endedAt
    ) {
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: {
          endedAt: new Date(),
          status:
            call.status === "RINGING" || call.status === "QUEUED"
              ? "COMPLETED"
              : call.status,
        },
      });
    }
    const { terminateVoiceV2CallSessionOnHangup } = await import(
      "@/lib/voice-v2/call-warmup"
    );
    terminateVoiceV2CallSessionOnHangup({
      workspaceId,
      callId: call.id,
      callControlId: call.telnyxCallControlId,
      conversationId: call.telnyxConversationId,
    });
    await enqueueJob({
      jobType: "voice_post_call",
      queueName: "voice-calls",
      payload: { callId: call.id, workspaceId },
      idempotencyKey: `voice-post-call:${call.id}`,
    });
  }

  if (eventType === "call.recording.saved") {
    await enqueueJob({
      jobType: "voice_recording_ingest",
      queueName: "voice-calls",
      payload: {
        callId: call.id,
        workspaceId,
        recordingUrl: eventPayload.recording_urls,
        providerRecordingId: eventPayload.recording_id,
      } as Prisma.InputJsonValue,
      idempotencyKey: `voice-recording:${call.id}:${eventPayload.recording_id || "0"}`,
    });
  }

  // AI-to-AI handoff analytics + loop counter on call metadata.
  if (
    eventType.includes("handoff") ||
    eventType === "assistant.handoff" ||
    eventType === "call.ai.handoff"
  ) {
    const meta = (call.metadata || {}) as Record<string, unknown>;
    const hops = Number(meta.handoffCount || 0) + 1;
    await prisma.voiceCallEvent.create({
      data: {
        workspaceId,
        callId: call.id,
        eventType: "ai.handoff",
        payload: {
          hops,
          toAssistantId: eventPayload.to_assistant_id || eventPayload.assistant_id,
          rawType: eventType,
        } as object,
      },
    }).catch(() => undefined);
    await prisma.voiceCall.update({
      where: { id: call.id },
      data: {
        metadata: {
          ...meta,
          handoffCount: hops,
          lastHandoffAt: new Date().toISOString(),
          lastHandoffTo:
            eventPayload.to_assistant_id || eventPayload.assistant_id || null,
        } as object,
      },
    });
    if (hops > 3) {
      const { recordFailureDiagnostic } = await import("../platform/ai-platform");
      await recordFailureDiagnostic({
        workspaceId,
        agentId: call.agentId,
        callId: call.id,
        category: "handoff",
        code: "loop_limit",
        message: `Handoff hop count ${hops} exceeded limit 3 — hanging up`,
      }).catch(() => undefined);
      const controlId = String(
        eventPayload.call_control_id || call.telnyxCallControlId || "",
      );
      if (controlId) {
        const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
        await telnyxRequest(`/calls/${controlId}/actions/hangup`, {
          method: "POST",
          body: {},
        }).catch(() => undefined);
      }
    }
  }

  // Persist live AI transcription segments / finals.
  if (
    eventType === "call.transcription" ||
    eventType === "call.transcription.received" ||
    eventType === "transcription.received" ||
    eventType === "call.conversation.ended" ||
    eventType === "assistant.conversation.ended"
  ) {
    const transcriptionData = (eventPayload.transcription_data ||
      eventPayload.transcription ||
      {}) as Record<string, unknown>;
    const text =
      String(
        transcriptionData.transcript ||
          eventPayload.transcript ||
          eventPayload.text ||
          "",
      ).trim() || "";
    const conversationId = String(
      eventPayload.conversation_id ||
        eventPayload.telnyx_conversation_id ||
        transcriptionData.conversation_id ||
        "",
    );

    let conversationRowId: string | null = null;
    if (conversationId) {
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { telnyxConversationId: conversationId },
      });
      const existingConv = await prisma.voiceAiConversation.findFirst({
        where: { workspaceId, telnyxConversationId: conversationId },
      });
      if (existingConv) {
        const updated = await prisma.voiceAiConversation.update({
          where: { id: existingConv.id },
          data: {
            callId: call.id,
            agentId: call.agentId,
            status: /ended/i.test(eventType) ? "ended" : "active",
            endedAt: /ended/i.test(eventType) ? new Date() : null,
          },
        });
        conversationRowId = updated.id;
      } else {
        const created = await prisma.voiceAiConversation.create({
          data: {
            workspaceId,
            agentId: call.agentId,
            callId: call.id,
            telnyxConversationId: conversationId,
            channel: "phone_call",
            status: /ended/i.test(eventType) ? "ended" : "active",
            endedAt: /ended/i.test(eventType) ? new Date() : null,
          },
        });
        conversationRowId = created.id;
      }
    }

    if (text) {
      let transcript = await prisma.voiceTranscript.findFirst({
        where: { workspaceId, callId: call.id },
      });
      if (!transcript) {
        transcript = await prisma.voiceTranscript.create({
          data: {
            workspaceId,
            callId: call.id,
            provider: "telnyx",
            status: "partial",
            language: "en",
            fullText: text,
          },
        });
      } else {
        const next = `${transcript.fullText || ""}\n${text}`.trim();
        transcript = await prisma.voiceTranscript.update({
          where: { id: transcript.id },
          data: {
            fullText: next,
            status: /ended/i.test(eventType) ? "completed" : "partial",
          },
        });
      }
      const startMs = Number(transcriptionData.start_ms);
      const endMs = Number(transcriptionData.end_ms);
      const confidence = Number(transcriptionData.confidence);
      const speaker = String(
        transcriptionData.track || eventPayload.track || eventPayload.role || "unknown",
      );
      await prisma.voiceTranscriptSegment
        .create({
          data: {
            workspaceId,
            transcriptId: transcript.id,
            speaker,
            text,
            startMs: Number.isFinite(startMs) ? startMs : null,
            endMs: Number.isFinite(endMs) ? endMs : null,
            confidence: Number.isFinite(confidence) ? confidence : null,
          },
        })
        .catch(() => undefined);

      // Persist live messages on VoiceAiConversationMessage (not only pull-sync).
      if (conversationRowId) {
        const role =
          /assistant|outbound|agent/i.test(speaker) || speaker === "outbound"
            ? "assistant"
            : /user|inbound|caller|customer/i.test(speaker) || speaker === "inbound"
              ? "user"
              : "transcript";
        await prisma.voiceAiConversationMessage
          .create({
            data: {
              workspaceId,
              conversationId: conversationRowId,
              role,
              content: text.slice(0, 8000),
              metadata: {
                eventType,
                speaker,
                startMs: Number.isFinite(startMs) ? startMs : null,
                endMs: Number.isFinite(endMs) ? endMs : null,
              } as object,
            },
          })
          .catch(() => undefined);
      }
    }

    // Persist native Telnyx Transfer attempts (phone Transfer ≠ AI Handoff).
    // Do NOT treat native "failed" as authoritative when a Call Control transfer
    // is still ringing — that race made the AI apologize while the phone rang.
    if (/conversation\.ended/i.test(eventType)) {
      const transferStatus = eventPayload.transfer_status as
        | { status?: string; target?: string; transferred?: boolean }
        | undefined;
      if (transferStatus && (transferStatus.target || transferStatus.status)) {
        const destination = String(transferStatus.target || "").trim();
        const transferred = Boolean(transferStatus.transferred);
        const statusRaw = String(transferStatus.status || "").toLowerCase();
        const inflightCc = await prisma.voiceTransfer.findFirst({
          where: {
            workspaceId,
            callId: call.id,
            transferType: { not: "native_telnyx_transfer" },
            status: {
              in: ["requested", "ringing", "bridging", "in_progress", "consulting"],
            },
          },
          orderBy: { createdAt: "desc" },
        });
        const status = transferred
          ? "completed"
          : inflightCc && statusRaw.includes("fail")
            ? "superseded_by_call_control"
            : statusRaw.includes("fail")
              ? "failed"
              : statusRaw || "unknown";
        const existing = await prisma.voiceTransfer.findFirst({
          where: {
            workspaceId,
            callId: call.id,
            destination: destination || undefined,
            transferType: "native_telnyx_transfer",
          },
          orderBy: { createdAt: "desc" },
        });
        if (existing) {
          await prisma.voiceTransfer.update({
            where: { id: existing.id },
            data: {
              status,
              answered: transferred,
              completedAt: new Date(),
              metadata: {
                ...((existing.metadata as object) || {}),
                transfer_status: transferStatus,
                conversationEndReason: eventPayload.reason || null,
                source: "call.conversation.ended",
                callControlInFlightId: inflightCc?.id || null,
              } as object,
            },
          });
        } else {
          await prisma.voiceTransfer.create({
            data: {
              workspaceId,
              callId: call.id,
              transferType: "native_telnyx_transfer",
              destination: destination || "unknown",
              status,
              answered: transferred,
              completedAt: new Date(),
              metadata: {
                transfer_status: transferStatus,
                conversationEndReason: eventPayload.reason || null,
                source: "call.conversation.ended",
                toolKind: "transfer",
                callControlInFlightId: inflightCc?.id || null,
              } as object,
            },
          });
        }
        if (transferred) {
          await prisma.voiceCall.update({
            where: { id: call.id },
            data: { transferred: true },
          });
        }
        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId,
              callId: call.id,
              eventType: "transfer.native_status",
              payload: {
                transfer_status: transferStatus,
                reason: eventPayload.reason || null,
                supersededByCallControl: Boolean(inflightCc && !transferred),
              } as object,
            },
          })
          .catch(() => undefined);
      }
    }

    // Caller end-of-speech → first audible agent audio (not LLM completion time).
    if (/conversation\.ended/i.test(eventType)) {
      const { captureCallResponseLatency } = await import(
        "@/lib/voice/response-latency"
      );
      await captureCallResponseLatency({
        callId: call.id,
        workspaceId,
      }).catch((err) =>
        console.warn("[voice/webhook] response latency capture failed", err),
      );
    }
  }

  await prisma.providerWebhookEvent.update({
    where: { providerEventId: input.providerEventId },
    data: { status: "processed", processedAt: new Date() },
  });

  return { ok: true, callId: call.id };
}
