/**
 * send_resource — model-facing capability: text an approved resource link.
 * Runtime owns phone, URLs, templates, workspace, idempotency.
 * Works on TeXML-direct calls even when VoiceCall was not created before the tool fires.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveVoiceSmsTemplate } from "@/lib/voice/sms/voice-sms-templates";
import {
  resourceTypeToTemplateId,
  resolveVoiceResourceConfig,
  VOICE_RESOURCE_TYPES,
} from "@/lib/voice/sms/voice-resource-config";
import { persistCallSessionFlags } from "@/lib/voice/call-session-context";
import { resolveVoiceOutboundSmsFrom } from "@/lib/voice/sms/voice-outbound-sms-from";
import {
  workflowToolResponse,
  type WorkflowToolResponse,
} from "@/lib/voice/tools/workflow-tool-contract";
import { VOICE_RUNTIME_STATE_KEY } from "@/lib/voice/runtime/types";
import { normalizeCallerAni } from "@/lib/voice/call-identity";

export type SendResourceContext = {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  resourceType: string;
  forceResend?: boolean;
  verbalSmsConsent?: boolean;
  telnyxConversationId?: string | null;
  telnyxCallControlId?: string | null;
  callerE164?: string | null;
  calledE164?: string | null;
};

function sessionKey(input: SendResourceContext): string {
  return (
    input.callId?.trim() ||
    input.telnyxConversationId?.trim() ||
    input.telnyxCallControlId?.trim() ||
    "voice-session"
  );
}

function consentAllowed(input: {
  resourceType: string;
  priorConsent: boolean;
  verbalSmsConsent?: boolean;
}): boolean {
  if (input.priorConsent || input.verbalSmsConsent === true) return true;
  // Workflow routes to send_resource only after the caller agreed to SMS; model often omits the flag.
  if (input.verbalSmsConsent === false) return false;
  return input.resourceType === "booking";
}

async function loadAgentConfig(workspaceId: string, agentId?: string | null) {
  if (!agentId) return null;
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
    select: {
      draftConfig: true,
      publishedVersion: { select: { config: true } },
    },
  });
  if (!agent) return null;
  const raw = agent.publishedVersion?.config ?? agent.draftConfig;
  return parseVoiceAgentConfig(raw);
}

function phoneFromRuntimeMetadata(metadata: Record<string, unknown>): string {
  const runtime = metadata[VOICE_RUNTIME_STATE_KEY];
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) return "";
  const collected = (runtime as { collectedFields?: Record<string, unknown> }).collectedFields;
  if (!collected || typeof collected !== "object") return "";
  for (const key of ["phone", "caller_phone", "sys_phone", "mobile"]) {
    const raw = collected[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (raw && typeof raw === "object" && "value" in (raw as object)) {
      const v = (raw as { value?: unknown }).value;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

async function resolveCallerE164(input: SendResourceContext, callId: string | null): Promise<string> {
  const direct = normalizeCallerAni(input.callerE164) || normalizeE164(input.callerE164 || "") || "";
  if (direct && direct !== "unknown") return direct;

  const prisma = getPrisma();
  if (callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, workspaceId: input.workspaceId },
      select: { fromE164: true, metadata: true },
    });
    const fromCall = normalizeCallerAni(call?.fromE164);
    if (fromCall) return fromCall;
    const meta =
      call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
        ? (call.metadata as Record<string, unknown>)
        : {};
    const fromMeta = normalizeCallerAni(phoneFromRuntimeMetadata(meta));
    if (fromMeta) return fromMeta;
    const aniMeta = normalizeCallerAni(
      typeof meta.ani === "string" ? meta.ani : typeof meta.caller_e164 === "string" ? meta.caller_e164 : "",
    );
    if (aniMeta) return aniMeta;
  }

  const convId = input.telnyxConversationId?.trim();
  if (convId) {
    const conv = await prisma.voiceAiConversation.findFirst({
      where: { workspaceId: input.workspaceId, telnyxConversationId: convId },
      select: { metadata: true, callId: true },
    });
    const convMeta =
      conv?.metadata && typeof conv.metadata === "object" && !Array.isArray(conv.metadata)
        ? (conv.metadata as Record<string, unknown>)
        : {};
    const fromConv = normalizeCallerAni(
      typeof convMeta.from === "string"
        ? convMeta.from
        : typeof convMeta.caller_e164 === "string"
          ? convMeta.caller_e164
          : typeof convMeta.ani === "string"
            ? convMeta.ani
            : "",
    );
    if (fromConv) return fromConv;
    if (conv?.callId && conv.callId !== callId) {
      const linked = await prisma.voiceCall.findFirst({
        where: { id: conv.callId, workspaceId: input.workspaceId },
        select: { fromE164: true },
      });
      const linkedAni = normalizeCallerAni(linked?.fromE164);
      if (linkedAni) return linkedAni;
    }
  }

  return "";
}

async function resolveCallId(input: SendResourceContext): Promise<string | null> {
  if (input.callId) return input.callId;
  if (!input.agentId) return null;
  const { ensureVoiceCallForToolWebhook } = await import("@/lib/voice/ensure-call-from-event");
  return ensureVoiceCallForToolWebhook({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callControlId: input.telnyxCallControlId || null,
    conversationId: input.telnyxConversationId || null,
    fromE164: input.callerE164 || null,
    toE164: input.calledE164 || null,
  }).catch(() => null);
}

export async function executeSendResource(input: SendResourceContext): Promise<WorkflowToolResponse> {
  const resourceType = input.resourceType?.trim().toLowerCase();
  if (!resourceType || !VOICE_RESOURCE_TYPES.includes(resourceType as never)) {
    return workflowToolResponse({
      status: "invalid_input",
      result: "unknown_resource_type",
      speak: "I'm not sure which link you wanted. I can text booking, quote, or financing information.",
    });
  }

  const callId = await resolveCallId(input);
  const prisma = getPrisma();

  let calledE164 = input.calledE164?.trim() || "";
  let metadata: Record<string, unknown> = {};

  if (callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: callId, workspaceId: input.workspaceId },
      select: { fromE164: true, toE164: true, agentId: true, metadata: true },
    });
    if (call) {
      if (!calledE164 && call.toE164) calledE164 = call.toE164;
      if (call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)) {
        metadata = call.metadata as Record<string, unknown>;
      }
    }
  }

  let callerE164 = await resolveCallerE164(input, callId);
  callerE164 = normalizeE164(callerE164) || callerE164;
  if (!callerE164 || callerE164 === "unknown") {
    return workflowToolResponse({
      status: "invalid_input",
      result: "caller_phone_missing",
      speak: "I don't have a good number to text. Can I take a message instead?",
    });
  }

  const config = await loadAgentConfig(input.workspaceId, input.agentId);
  const resources = resolveVoiceResourceConfig(config);

  const enabledMap: Record<string, boolean> = {
    booking: resources.booking,
    quote: resources.quote,
    financing: resources.financing,
    directions: resources.directions,
    photo_upload: resources.photoUpload,
  };
  if (!resources.smsEnabled) {
    return workflowToolResponse({
      status: "not_allowed",
      result: "sms_disabled",
      speak: "Text messaging isn't available right now. I can take your information for a callback.",
      dynamicVariables: { resource_send_status: "not_allowed" },
    });
  }
  if (!enabledMap[resourceType]) {
    return workflowToolResponse({
      status: "not_configured",
      result: `${resourceType}_unavailable`,
      speak: `I can't send that link right now, but I can take your information and have someone follow up.`,
      dynamicVariables: { resource_send_status: "not_configured", resource_send_type: resourceType },
    });
  }

  const priorConsent =
    metadata.verbal_sms_consent === true || metadata.sms_verbal_consent === true;
  if (!consentAllowed({ resourceType, priorConsent, verbalSmsConsent: input.verbalSmsConsent })) {
    return workflowToolResponse({
      status: "not_allowed",
      result: "sms_consent_required",
      speak:
        "I need your permission before I text you. Is it okay if I send that link by text? Message and data rates may apply.",
      dynamicVariables: { resource_send_status: "consent_required" },
    });
  }

  const priorType = String(metadata.resource_send_type || "");
  const priorStatus = String(metadata.resource_send_status || "");
  if (
    !input.forceResend &&
    priorStatus === "success" &&
    priorType === resourceType
  ) {
    return workflowToolResponse({
      status: "already_completed",
      result: `${resourceType}_link_already_sent`,
      speak: "I already texted that link to you. Did you want me to send it again?",
      dynamicVariables: {
        resource_send_status: "already_completed",
        resource_send_type: resourceType,
      },
    });
  }

  const templateId = resourceTypeToTemplateId(resourceType);
  if (!templateId) {
    return workflowToolResponse({
      status: "not_configured",
      result: "template_missing",
      speak: "I can't send that link right now.",
    });
  }

  const key = sessionKey({ ...input, callId });
  const resolved = resolveVoiceSmsTemplate({
    templateId,
    callId: key,
    businessName: resources.businessName,
    bookingUrl: resources.bookingUrl,
    websiteUrl: resources.websiteUrl,
  });

  try {
    const fromE164 = await resolveVoiceOutboundSmsFrom({
      workspaceId: input.workspaceId,
      calledE164: calledE164 || null,
      agentId: input.agentId,
      config,
    });
    await sendQuickSms({
      workspaceId: input.workspaceId,
      to: callerE164,
      from: fromE164,
      body: resolved.body,
      idempotencyKey: resolved.idempotencyKey,
    });
    if (callId) {
      await persistCallSessionFlags(callId, {
        resource_send_status: "success",
        resource_send_type: resourceType,
        verbal_sms_consent: true,
        sms_verbal_consent: true,
      });
    }
    return workflowToolResponse({
      status: "success",
      result: `${resourceType}_link_sent`,
      speak: "Done — I just texted that to you.",
      dynamicVariables: {
        resource_send_status: "success",
        resource_send_type: resourceType,
      },
    });
  } catch (err) {
    console.error(
      "[send_resource] sms failed",
      err instanceof Error ? err.message : err,
    );
    if (callId) {
      await persistCallSessionFlags(callId, {
        resource_send_status: "temporarily_unavailable",
        resource_send_type: resourceType,
      });
    }
    return workflowToolResponse({
      status: "temporarily_unavailable",
      result: "sms_send_failed",
      speak: "I wasn't able to send that text just now. I can take your information for a callback instead.",
      dynamicVariables: {
        resource_send_status: "temporarily_unavailable",
        resource_send_type: resourceType,
      },
    });
  }
}
