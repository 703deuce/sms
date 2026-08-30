/**
 * send_resource — model-facing capability: text an approved resource link.
 * Runtime owns phone, URLs, templates, workspace, idempotency.
 */

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { resolveVoiceSmsTemplate } from "@/lib/voice/sms/voice-sms-templates";
import {
  resourceTypeToTemplateId,
  resolveVoiceResourceConfig,
  VOICE_RESOURCE_TYPES,
} from "@/lib/voice/sms/voice-resource-config";
import { persistCallSessionFlags } from "@/lib/voice/call-session-context";
import {
  workflowToolResponse,
  type WorkflowToolResponse,
} from "@/lib/voice/tools/workflow-tool-contract";

export async function executeSendResource(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  resourceType: string;
  forceResend?: boolean;
}): Promise<WorkflowToolResponse> {
  const resourceType = input.resourceType?.trim().toLowerCase();
  if (!resourceType || !VOICE_RESOURCE_TYPES.includes(resourceType as never)) {
    return workflowToolResponse({
      status: "invalid_input",
      result: "unknown_resource_type",
      speak: "I'm not sure which link you wanted. I can text booking, quote, or financing information.",
    });
  }

  if (!input.callId) {
    return workflowToolResponse({
      status: "temporarily_unavailable",
      result: "call_not_ready",
      speak: "I'm still connecting your call. One moment please.",
    });
  }

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { fromE164: true, agentId: true, metadata: true },
  });
  if (!call?.fromE164 || call.fromE164 === "unknown") {
    return workflowToolResponse({
      status: "invalid_input",
      result: "caller_phone_missing",
      speak: "I don't have a good number to text. Can I take a message instead?",
    });
  }

  const agent = await prisma.voiceAgent.findFirst({
    where: {
      id: input.agentId || call.agentId || "",
      workspaceId: input.workspaceId,
    },
    select: { draftConfig: true },
  });
  const config = agent ? parseVoiceAgentConfig(agent.draftConfig) : null;
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

  const meta =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const priorType = String(meta.resource_send_type || "");
  const priorStatus = String(meta.resource_send_status || "");
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

  const resolved = resolveVoiceSmsTemplate({
    templateId,
    callId: input.callId,
    businessName: resources.businessName,
    bookingUrl: resources.bookingUrl,
    websiteUrl: resources.websiteUrl,
  });

  try {
    await sendQuickSms({
      workspaceId: input.workspaceId,
      to: call.fromE164,
      body: resolved.body,
      idempotencyKey: resolved.idempotencyKey,
    });
    await persistCallSessionFlags(input.callId, {
      resource_send_status: "success",
      resource_send_type: resourceType,
    });
    return workflowToolResponse({
      status: "success",
      result: `${resourceType}_link_sent`,
      speak: "Done — I just texted that to you.",
      dynamicVariables: {
        resource_send_status: "success",
        resource_send_type: resourceType,
      },
    });
  } catch {
    await persistCallSessionFlags(input.callId, {
      resource_send_status: "temporarily_unavailable",
      resource_send_type: resourceType,
    });
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
