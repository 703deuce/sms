import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { evaluateInboundRouting } from "./routing";
import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";
import {
  isTelnyxVoiceConfigured,
  startAiAssistantOnCall,
  startCallRecording,
  startCallTranscription,
} from "./telnyx/assistant-sync";
import { parseVoiceAgentConfig } from "./types";

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

async function resolveRecordingDisclosure(workspaceId: string, agentId?: string | null) {
  const prisma = getPrisma();
  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId },
  });
  const complianceSettings = (compliance?.settings || {}) as Record<string, unknown>;
  if (complianceSettings.recordingDisclosureText) {
    return String(complianceSettings.recordingDisclosureText);
  }
  if (!agentId) return null;
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!agent) return null;
  const cfg = parseVoiceAgentConfig(agent.draftConfig);
  const fromCompliance = (cfg.compliance || {}) as Record<string, unknown>;
  if (fromCompliance.recordingDisclosureText) {
    return String(fromCompliance.recordingDisclosureText);
  }
  return null;
}

async function speakOnCall(callControlId: string, text: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/speak`, {
    method: "POST",
    body: { payload: text, voice: "female", language: "en-US" },
  }).catch(() => undefined);
}

async function speakRecordingDisclosure(
  workspaceId: string,
  callId: string,
  callControlId: string,
  agentId?: string | null,
) {
  const text = await resolveRecordingDisclosure(workspaceId, agentId);
  if (!text?.trim()) return;
  await speakOnCall(callControlId, text.trim());
  await getPrisma().voiceCallEvent.create({
    data: {
      workspaceId,
      callId,
      eventType: "compliance.recording_disclosure",
      payload: { text } as object,
    },
  });
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

  if (isTelnyxVoiceConfigured() && input.telnyxCallControlId) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);

    await speakRecordingDisclosure(
      input.workspaceId,
      input.callId,
      input.telnyxCallControlId,
      agent.id,
    );

    if (agent.telnyxAssistantId) {
      const callRow = await prisma.voiceCall.findUnique({ where: { id: input.callId } });
      const { resolveCallDynamicVariables } = await import("./dynamic-variables");
      const dynamicVariables = await resolveCallDynamicVariables({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        callId: input.callId,
        contactId: callRow?.contactId,
        fromE164: callRow?.fromE164,
        toE164: callRow?.toE164,
        direction: "INBOUND",
        overrides: (callRow?.dynamicVariables || null) as Record<string, unknown> | null,
      });
      if (input.contactName) dynamicVariables.full_name = input.contactName;

      const personalized = input.contactName
        ? `Hi ${input.contactName}, thanks for calling.`
        : undefined;
      await startAiAssistantOnCall({
        callControlId: input.telnyxCallControlId,
        assistantId: agent.telnyxAssistantId,
        greeting: personalized,
        dynamicVariables,
        clientState: {
          workspaceId: input.workspaceId,
          callId: input.callId,
          agentId: agent.id,
        },
      }).catch((err) => console.error("[voice/inbound] ai_assistant_start", err));

      await startCallRecording(input.telnyxCallControlId);
      await startCallTranscription(input.telnyxCallControlId);

      const { resolveAiVersionStamp } = await import("./platform/admission");
      const versionStamp = await resolveAiVersionStamp({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        publishedVersionId: agent.publishedVersionId,
      });

      await prisma.voiceCall.update({
        where: { id: input.callId },
        data: {
          status: "IN_PROGRESS",
          answeredAt: new Date(),
          agentVersionId: versionStamp.agentVersionId,
          dynamicVariables: dynamicVariables as object,
          metadata: {
            routing: input.routing,
            payload: input.payload,
            aiStarted: true,
            assistantId: agent.telnyxAssistantId,
            transcriptionStarted: true,
            assistantVersionId: versionStamp.assistantVersionId,
            canaryVersionId: versionStamp.canaryVersionId,
            canaryActive: versionStamp.canaryActive,
          } as object,
        },
      });
      return { started: true, assistantId: agent.telnyxAssistantId };
    }
  }

  return { started: false, reason: "telnyx_not_configured_or_no_assistant" };
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
  const timeoutSeconds = Number(input.actions?.timeoutSeconds || input.actions?.ringTimeout || 30);
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
    const cfg = parseVoiceAgentConfig(agent?.draftConfig);
    const vm = (cfg.voicemail || {}) as Record<string, unknown>;
    if (vm.greetingText) greeting = String(vm.greetingText);
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

async function resolveEffectiveAction(
  workspaceId: string,
  action: string,
  _actions?: Record<string, unknown>,
  now = new Date(),
) {
  if (action !== "ai_after_hours") return action;

  const settings = await getMessagingRuntimeSettings(workspaceId);
  const withinHours = isWithinBusinessHours(settings, now);
  if (withinHours) return "human_first";
  return "ai_answer";
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
  const action = await resolveEffectiveAction(
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
    if (human && ["in_progress", "completed", "answered"].includes(human.status)) {
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
