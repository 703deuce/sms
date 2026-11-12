import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { evaluateInboundRouting } from "./routing";
import {
  resolveEffectiveRoutingAction,
  resolveRingTimeoutSeconds,
} from "./routing-action-resolve";
import { isTelnyxVoiceConfigured } from "./telnyx/assistant-sync";
import { claimAiStart } from "./ai-start-lock";

/** Honor draftConfig.callHandling.callRecording: off | inbound_only | all. */
export function shouldStartCallRecording(
  callRecording: unknown,
  direction: "INBOUND" | "OUTBOUND" = "INBOUND",
): boolean {
  const mode = String(callRecording ?? "all").toLowerCase();
  if (mode === "off" || mode === "none" || mode === "disabled") return false;
  if (mode === "inbound_only") return direction === "INBOUND";
  // "all" or unrecognized — record
  return true;
}

const AI_START_FAILURE_APOLOGY =
  "We're sorry, our assistant is temporarily unavailable. Please leave your name and number after the tone, or call back shortly. Goodbye.";

export async function handleAiAssistantStartFailure(input: {
  workspaceId: string;
  callId: string;
  telnyxCallControlId: string;
  fromE164?: string | null;
  error: unknown;
}) {
  const prisma = getPrisma();
  const errMsg =
    input.error instanceof Error ? input.error.message : String(input.error);
  console.error("[voice/inbound] ai_assistant_start failed", input.error);

  let spoke = false;
  if (input.telnyxCallControlId && isTelnyxVoiceConfigured()) {
    try {
      await speakOnCall(input.telnyxCallControlId, AI_START_FAILURE_APOLOGY);
      spoke = true;
    } catch (speakErr) {
      console.warn(
        "[voice/inbound] ai_start failure apology speak failed",
        speakErr instanceof Error ? speakErr.message : speakErr,
      );
    }
  }

  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true, fromE164: true },
  });
  const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
  const fromPhone = input.fromE164 || existing?.fromE164 || "";

  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        outcome: "message_taken",
        status: "COMPLETED",
        endedAt: new Date(),
        metadata: {
          ...prevMeta,
          aiStarted: false,
          aiStartFailed: true,
          aiStartError: errMsg.slice(0, 500),
          structuredMessage: {
            callerName: "",
            phone: fromPhone,
            reason: "AI assistant failed to start — caller offered apology fallback",
            urgency: "normal",
            notes: spoke
              ? "Apology spoken via Call Control; no interactive message capture."
              : "Apology speak unavailable; take-message disposition recorded.",
          },
        } as object,
      },
    })
    .catch(() => undefined);

  await prisma.voiceCallEvent
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.ai_assistant_start_failed",
        payload: {
          error: errMsg.slice(0, 500),
          apologySpoken: spoke,
          disposition: "message_taken",
        } as object,
      },
    })
    .catch(() => undefined);

  await prisma.auditLog
    .create({
      data: {
        workspaceId: input.workspaceId,
        event: "voice.message_taken",
        detail: JSON.stringify({
          callId: input.callId,
          reason: "ai_assistant_start_failed",
          apologySpoken: spoke,
          phone: fromPhone,
        }),
      },
    })
    .catch(() => undefined);

  if (input.telnyxCallControlId && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  return { spoke, disposition: "message_taken" as const };
}

type InboundInput = {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  payload?: Record<string, unknown>;
};

async function loadContactContext(workspaceId: string, from: string) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: from } },
  });
  if (!contact) {
    return {
      contact: null,
      contactTags: [],
      isKnownContact: false,
      department: null,
      language: null,
      intent: null,
    };
  }
  const tags = await prisma.contactTag.findMany({ where: { contactId: contact.id } });
  const contactTags = tags.map((t: { tagId: string }) => t.tagId);
  const cf = (contact.customFields || {}) as Record<string, unknown>;
  return {
    contact,
    contactTags,
    isKnownContact: true,
    department: cf.department ? String(cf.department) : null,
    language: cf.language ? String(cf.language) : null,
    intent: cf.intent ? String(cf.intent) : null,
  };
}

async function speakOnCall(callControlId: string, text: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/speak`, {
    method: "POST",
    body: { payload: text, voice: "female", language: "en-US" },
  }).catch(() => undefined);
}

async function startAiOnInboundCall(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  contactName?: string;
  routing: Record<string, unknown>;
  payload?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) return { started: false, reason: "agent_missing" };

  const { loadVoiceAgentRuntimeConfig } = await import("./load-agent-config");
  const { isAppointmentReceptionistAgent } = await import(
    "@/lib/voice-v3/config/from-published-agent"
  );
  const agentRuntimeCfg = await loadVoiceAgentRuntimeConfig(input.workspaceId, agent.id);

  if (!isAppointmentReceptionistAgent(agentRuntimeCfg)) {
    const { handleUnsupportedVoiceAgentRuntime } = await import(
      "@/lib/voice-v3/unsupported-voice-agent"
    );
    return handleUnsupportedVoiceAgentRuntime({
      workspaceId: input.workspaceId,
      callId: input.callId,
      agentId: agent.id,
      telnyxCallControlId: input.telnyxCallControlId,
      path: "inbound_ai_start",
    });
  }

  if (!isTelnyxVoiceConfigured() || !input.telnyxCallControlId) {
    return { started: false, reason: "telnyx_not_configured" };
  }

  const { usesTexmlDirectInbound } = await import("./telnyx/texml-direct-route");
  if (usesTexmlDirectInbound(agentRuntimeCfg)) {
    await prisma.voiceCallEvent
      .create({
        data: {
          workspaceId: input.workspaceId,
          callId: input.callId,
          eventType: "media.ai_start_skipped",
          payload: {
            reason: "texml_direct_inbound",
            path: "inbound_ai_start_receptionist",
          } as object,
        },
      })
      .catch(() => undefined);
    return { started: false, reason: "texml_direct_inbound" };
  }

  const { assertAiCallAdmission } = await import("./platform/admission");
  const admission = await assertAiCallAdmission({
    workspaceId: input.workspaceId,
    agentId: agent.id,
    direction: "INBOUND",
    callId: input.callId,
  });
  if (!admission.ok) {
    return { started: false, reason: admission.code };
  }

  const claim = await claimAiStart(input.callId);
  if (!claim.claimed) {
    return { started: false, reason: claim.reason || "ai_start_claimed" };
  }

  const { startAppointmentReceptionistVoiceV3OnCall } = await import(
    "@/lib/voice-v3/start-appointment-receptionist-pstn"
  );
  const started = await startAppointmentReceptionistVoiceV3OnCall({
    workspaceId: input.workspaceId,
    callId: input.callId,
    agentId: agent.id,
    telnyxCallControlId: input.telnyxCallControlId,
    claimMeta: claim.meta,
    path: "inbound_ai_start",
  });
  if (!started.started) {
    await handleAiAssistantStartFailure({
      workspaceId: input.workspaceId,
      callId: input.callId,
      telnyxCallControlId: input.telnyxCallControlId,
      error: new Error(started.reason),
    }).catch(() => undefined);
  }
  return started;
}

async function executeHumanFirst(input: {
  workspaceId: string;
  callId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  routing: Record<string, unknown>;
  actions?: Record<string, unknown>;
}) {
  const timeoutSeconds = resolveRingTimeoutSeconds(input.actions, 30);
  const queueId = input.actions?.queueId as string | undefined;
  const agentId = input.actions?.agentId as string | undefined;

  let humanCallId: string | undefined;
  if (input.telnyxCallControlId) {
    const { handleInboundHumanCall } = await import("@/lib/phone/human-call-service");
    const human = await handleInboundHumanCall({
      workspaceId: input.workspaceId,
      fromE164: input.fromE164,
      toE164: input.toE164,
      telnyxCallControlId: input.telnyxCallControlId,
      queueId: queueId || null,
      routingNote: `voice_human_first:${input.callId}`,
    });
    humanCallId = human.callId;
  }

  await getPrisma().voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        routing: input.routing,
        humanFirst: true,
        humanCallId,
        queueId,
        fallbackAgentId: agentId,
      } as object,
    },
  });

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "voice_human_first_timeout",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      humanCallId,
      telnyxCallControlId: input.telnyxCallControlId,
      agentId,
    },
    idempotencyKey: `human-first-timeout-${input.callId}`,
    runAfter: new Date(Date.now() + timeoutSeconds * 1000),
  });

  return { humanCallId, timeoutSeconds };
}

async function executeTransfer(input: {
  workspaceId: string;
  callId: string;
  destination: string;
  telnyxCallControlId?: string;
  transferType?: string;
  summary?: string;
}) {
  if (!input.destination) throw new Error("Transfer destination required");
  const { initiateTransfer } = await import("./transfers");
  return initiateTransfer({
    workspaceId: input.workspaceId,
    callId: input.callId,
    destination: input.destination,
    transferType: input.transferType || "cold_transfer",
    summary: input.summary,
  });
}

async function executeVoicemail(input: {
  workspaceId: string;
  callId: string;
  telnyxCallControlId?: string;
  greetingText?: string;
  agentId?: string | null;
}) {
  const prisma = getPrisma();
  let greeting =
    input.greetingText ||
    "Please leave a message after the tone and we will get back to you soon.";

  if (!input.greetingText && input.agentId) {
    const agent = await prisma.voiceAgent.findUnique({ where: { id: input.agentId } });
    if (agent) {
      const { loadVoiceAgentRuntimeConfig } = await import("./load-agent-config");
      const cfg = await loadVoiceAgentRuntimeConfig(agent.workspaceId, agent.id);
      const vm = (cfg.voicemail || {}) as Record<string, unknown>;
      if (vm.greetingText) greeting = String(vm.greetingText);
    }
  }

  if (input.telnyxCallControlId && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    await speakOnCall(input.telnyxCallControlId, greeting);
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/record_start`, {
      method: "POST",
      body: { format: "mp3", channels: "single", play_beep: true, max_length: 180 },
    }).catch(() => undefined);
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: { status: "VOICEMAIL", voicemailDetected: true },
  });

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      eventType: "inbound.voicemail",
      payload: { greeting } as object,
    },
  });

  return { ok: true };
}

async function executeHangup(telnyxCallControlId?: string) {
  if (telnyxCallControlId && isTelnyxVoiceConfigured() && !telnyxCallControlId.startsWith("mock_")) {
    await telnyxRequest(`/calls/${telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }
  return { ok: true };
}

async function executeOverflow(input: {
  workspaceId: string;
  callId: string;
  telnyxCallControlId?: string;
  actions?: Record<string, unknown>;
  routing: Record<string, unknown>;
  agentId?: string | null;
  fromE164: string;
  toE164: string;
}) {
  const overflowType = String(input.actions?.overflowType || input.actions?.type || "transfer");
  const destination = String(input.actions?.destination || input.actions?.overflowTarget || "");
  const overflowAgentId = String(
    input.actions?.agentId || input.actions?.overflowAgentId || input.agentId || "",
  );

  if (overflowType === "ai_agent" && overflowAgentId) {
    return startAiOnInboundCall({
      workspaceId: input.workspaceId,
      callId: input.callId,
      agentId: overflowAgentId,
      telnyxCallControlId: input.telnyxCallControlId || "",
      routing: input.routing,
    });
  }

  if (overflowType === "voicemail") {
    return executeVoicemail({
      workspaceId: input.workspaceId,
      callId: input.callId,
      telnyxCallControlId: input.telnyxCallControlId,
      agentId: input.agentId,
    });
  }

  if (overflowType === "hangup") {
    await executeHangup(input.telnyxCallControlId);
    await getPrisma().voiceCall.update({
      where: { id: input.callId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
    return { ok: true, action: "hangup" };
  }

  if (destination) {
    return executeTransfer({
      workspaceId: input.workspaceId,
      callId: input.callId,
      destination,
      telnyxCallControlId: input.telnyxCallControlId,
    });
  }

  return executeHumanFirst({
    workspaceId: input.workspaceId,
    callId: input.callId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    routing: input.routing,
    actions: input.actions,
  });
}

export async function executeInboundRoutingAction(input: {
  workspaceId: string;
  callId: string;
  routing: {
    action: string;
    agentId?: string;
    destination?: string;
    queueId?: string;
    actions?: Record<string, unknown>;
  };
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  contactName?: string;
  payload?: Record<string, unknown>;
}) {
  const action = await resolveEffectiveRoutingAction(
    input.workspaceId,
    input.routing.action,
    input.routing.actions,
  );
  const actions = input.routing.actions || {};
  const agentId = input.routing.agentId || (actions.agentId as string | undefined);

  switch (action) {
    case "ai_answer":
      if (!agentId) return { ok: false, reason: "no_agent" };
      return startAiOnInboundCall({
        workspaceId: input.workspaceId,
        callId: input.callId,
        agentId,
        telnyxCallControlId: input.telnyxCallControlId || "",
        contactName: input.contactName,
        routing: input.routing as Record<string, unknown>,
        payload: input.payload,
      });

    case "human_first":
      return executeHumanFirst({
        workspaceId: input.workspaceId,
        callId: input.callId,
        fromE164: input.fromE164,
        toE164: input.toE164,
        telnyxCallControlId: input.telnyxCallControlId,
        routing: input.routing as Record<string, unknown>,
        actions: { ...actions, agentId, queueId: input.routing.queueId },
      });

    case "transfer":
      return executeTransfer({
        workspaceId: input.workspaceId,
        callId: input.callId,
        destination: input.routing.destination || String(actions.destination || ""),
        telnyxCallControlId: input.telnyxCallControlId,
        transferType: String(actions.transferType || "cold_transfer"),
        summary: String(actions.summary || ""),
      });

    case "voicemail":
      return executeVoicemail({
        workspaceId: input.workspaceId,
        callId: input.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        greetingText: actions.greetingText ? String(actions.greetingText) : undefined,
        agentId,
      });

    case "hangup":
      await executeHangup(input.telnyxCallControlId);
      await getPrisma().voiceCall.update({
        where: { id: input.callId },
        data: { status: "COMPLETED", endedAt: new Date() },
      });
      return { ok: true, action: "hangup" };

    case "overflow":
      return executeOverflow({
        workspaceId: input.workspaceId,
        callId: input.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        actions,
        routing: input.routing as Record<string, unknown>,
        agentId,
        fromE164: input.fromE164,
        toE164: input.toE164,
      });

    default:
      if (agentId) {
        return startAiOnInboundCall({
          workspaceId: input.workspaceId,
          callId: input.callId,
          agentId,
          telnyxCallControlId: input.telnyxCallControlId || "",
          contactName: input.contactName,
          routing: input.routing as Record<string, unknown>,
          payload: input.payload,
        });
      }
      return { ok: false, reason: `unknown_action:${action}` };
  }
}

/** Missed inbound legs still use status `completed` — do not treat that as a human answer. */
function humanCallWasAnsweredByHuman(human: {
  status: string;
  answeredAt: Date | null;
  disposition: string | null;
}) {
  if (human.answeredAt) return true;
  if (human.status === "in_progress" || human.status === "answered") return true;
  const disposition = String(human.disposition || "");
  if (disposition.startsWith("missed:") || disposition === "missed") return false;
  if (human.status === "completed" && !disposition) return true;
  return false;
}

/** Fallback to AI when human-first ring times out without an answer. */
export async function handleHumanFirstTimeoutJob(payload: {
  workspaceId: string;
  callId: string;
  humanCallId?: string;
  telnyxCallControlId?: string;
  agentId?: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: payload.callId, workspaceId: payload.workspaceId },
  });
  if (!call) return { skipped: true, reason: "call_missing" };

  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (meta.aiStarted) return { skipped: true, reason: "ai_already_started" };

  if (payload.humanCallId) {
    const human = await prisma.humanCall.findUnique({ where: { id: payload.humanCallId } });
    if (human && humanCallWasAnsweredByHuman(human)) {
      return { skipped: true, reason: "human_answered" };
    }
  }

  const agentId =
    payload.agentId ||
    (meta.fallbackAgentId as string | undefined) ||
    call.agentId ||
    undefined;
  if (!agentId) return { skipped: true, reason: "no_fallback_agent" };

  const controlId = payload.telnyxCallControlId || call.telnyxCallControlId || "";
  const result = await startAiOnInboundCall({
    workspaceId: payload.workspaceId,
    callId: call.id,
    agentId,
    telnyxCallControlId: controlId,
    routing: (meta.routing as Record<string, unknown>) || {},
  });

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      callId: call.id,
      eventType: "inbound.human_first_timeout",
      payload: { agentId, result } as object,
    },
  });

  return { ok: true, ...result };
}

export async function handleInboundCallEvent(input: InboundInput) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);
  const to = input.toE164;

  const { contact, contactTags, isKnownContact, department, language, intent } =
    await loadContactContext(input.workspaceId, from);

  const forcedAgentIdRaw =
    typeof input.payload?.forcedAgentId === "string" ? input.payload.forcedAgentId : null;
  const forcedAgent = forcedAgentIdRaw
    ? await prisma.voiceAgent.findFirst({
        where: { id: forcedAgentIdRaw, workspaceId: input.workspaceId },
        select: { id: true },
      })
    : null;
  const forcedAgentId = forcedAgent?.id || null;

  let routing = await evaluateInboundRouting({
    workspaceId: input.workspaceId,
    fromE164: from,
    toE164: to,
    contactId: contact?.id,
    contactTags,
    isKnownContact,
    department,
    language,
    intent,
  });

  if (forcedAgentId) {
    routing = {
      ...routing,
      action: "ai_answer",
      agentId: forcedAgentId,
      actions: { ...(routing.actions || {}), agentId: forcedAgentId, forced: true },
    };
  }

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: to },
  });

  const inboundAgentId = forcedAgentId || routing.agentId || null;
  let inboundAgentVersionId: string | null = null;
  if (inboundAgentId) {
    const inboundAgent = await prisma.voiceAgent.findFirst({
      where: { id: inboundAgentId, workspaceId: input.workspaceId },
      select: { publishedVersionId: true },
    });
    inboundAgentVersionId = inboundAgent?.publishedVersionId || null;
  }

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: inboundAgentId,
      agentVersionId: inboundAgentVersionId,
      contactId: contact?.id,
      direction: "INBOUND",
      status: "RINGING",
      fromE164: from,
      toE164: to,
      phoneNumberId: pn?.id,
      telnyxCallControlId: input.telnyxCallControlId,
      metadata: { routing, payload: input.payload } as object,
    },
  });

  const { isGptLivePstnLeanInbound } = await import(
    "@/lib/voice/telnyx/openai-realtime-bridge/flags"
  );

  // Bind workflow execution for live TriggerDeployments (orchestration only —
  // TeXML already launched the assistant; worker is not in the audio path).
  if (!isGptLivePstnLeanInbound()) {
  try {
    const {
      ensureInboundCallerContact,
      enrollInboundCallTriggers,
    } = await import("@/lib/automations/inbound-trigger-enroll");
    let contactId = contact?.id || null;
    if (!contactId && from) {
      const ensured = await ensureInboundCallerContact({
        workspaceId: input.workspaceId,
        fromE164: from,
      });
      contactId = ensured.id;
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { contactId },
      });
    }
    if (contactId && pn?.id) {
      const enrollments = await enrollInboundCallTriggers({
        workspaceId: input.workspaceId,
        callId: call.id,
        phoneNumberId: pn.id,
        contactId,
        agentId: inboundAgentId,
        eventType: "every_call",
      });
      if (enrollments.length) {
        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId: input.workspaceId,
              callId: call.id,
              eventType: "inbound.workflow_enrolled",
              payload: { enrollments } as object,
            },
          })
          .catch(() => undefined);
      }
    }
  } catch (err) {
    console.error("[inbound] workflow enroll failed", err);
  }
  }

  const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");

  const actionResult = await executeInboundRoutingAction({
    workspaceId: input.workspaceId,
    callId: call.id,
    routing,
    fromE164: from,
    toE164: to,
    telnyxCallControlId: input.telnyxCallControlId,
    contactName: contactName || undefined,
    payload: input.payload,
  });

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      callId: call.id,
      eventType: "inbound.routed",
      payload: { routing, actionResult } as object,
    },
  });

  return { callId: call.id, routing, actionResult };
}
