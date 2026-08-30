/**
 * Fast local call/business context for Telnyx dynamic variables and workflow edges.
 * No slow external CRM calls during initialization.
 */

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "./types";
import { buildBusinessLocalClock } from "./runtime-clock";
import { resolveVoiceResourceConfig } from "./sms/voice-resource-config";

export type CallSessionContext = {
  business_name: string;
  business_timezone: string;
  business_open_now: string;
  after_hours: string;
  booking_enabled: string;
  sms_enabled: string;
  quote_enabled: string;
  financing_enabled: string;
  directions_enabled: string;
  photo_upload_enabled: string;
  transfer_available: string;
  transfer_enabled: string;
  resource_configured: string;
  available_resource_types: string;
  caller_name: string;
  existing_customer: string;
  customer_found: string;
  resource_send_status: string;
  resource_send_type: string;
};

function boolStr(value: boolean): string {
  return value ? "true" : "false";
}

export async function resolveCallSessionContext(input: {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  fromE164?: string | null;
  config?: VoiceAgentConfig | null;
}): Promise<CallSessionContext> {
  const prisma = getPrisma();
  let businessName = "the business";
  let timezone = "America/New_York";
  let config = input.config || null;

  if (input.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { displayName: true, name: true, draftConfig: true },
    });
    if (agent) {
      businessName = agent.displayName || agent.name || businessName;
      config = config || parseVoiceAgentConfig(agent.draftConfig);
    }
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { displayName: true, name: true },
  });
  if (ws?.displayName || ws?.name) {
    businessName = ws.displayName || ws.name || businessName;
  }

  const messaging = await prisma.workspaceMessagingSettings.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (messaging?.timezone) timezone = String(messaging.timezone);

  const resources = resolveVoiceResourceConfig(config);
  const transferTargets = await prisma.voiceTransferDestination.count({
    where: {
      workspaceId: input.workspaceId,
      enabled: true,
      OR: input.agentId
        ? [{ agentId: input.agentId }, { agentId: null }]
        : [{ agentId: null }],
    },
  });
  const transferEnabled =
    Boolean((config?.transfers as { destinationPhone?: string } | undefined)?.destinationPhone) ||
    transferTargets > 0;

  let callerName = "";
  let existingCustomer = "false";
  let customerFound = "false";
  if (input.fromE164) {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone: input.fromE164 },
      select: { firstName: true, lastName: true },
    });
    if (contact) {
      callerName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      existingCustomer = "true";
      customerFound = "true";
    }
  }

  let resourceSendStatus = "";
  let resourceSendType = "";
  if (input.callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: { metadata: true },
    });
    const meta =
      call?.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
        ? (call.metadata as Record<string, unknown>)
        : {};
    resourceSendStatus = String(meta.resource_send_status || "");
    resourceSendType = String(meta.resource_send_type || "");
    if (!callerName && typeof meta.caller_display_name === "string") {
      callerName = meta.caller_display_name;
    }
  }

  const clock = buildBusinessLocalClock(timezone);
  const available = resources.enabledTypes.join(",");

  return {
    business_name: businessName,
    business_timezone: clock.business_timezone,
    business_open_now: boolStr(true),
    after_hours: boolStr(false),
    booking_enabled: boolStr(resources.booking),
    sms_enabled: boolStr(resources.smsEnabled),
    quote_enabled: boolStr(resources.quote),
    financing_enabled: boolStr(resources.financing),
    directions_enabled: boolStr(resources.directions),
    photo_upload_enabled: boolStr(resources.photoUpload),
    transfer_available: boolStr(transferEnabled),
    transfer_enabled: boolStr(transferEnabled),
    resource_configured: boolStr(resources.anyConfigured),
    available_resource_types: available || "none",
    caller_name: callerName,
    existing_customer: existingCustomer,
    customer_found: customerFound,
    resource_send_status: resourceSendStatus,
    resource_send_type: resourceSendType,
  };
}

export async function persistCallSessionFlags(
  callId: string,
  flags: Partial<Pick<CallSessionContext, "resource_send_status" | "resource_send_type">>,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        ...(flags.resource_send_status != null
          ? { resource_send_status: flags.resource_send_status }
          : {}),
        ...(flags.resource_send_type != null
          ? { resource_send_type: flags.resource_send_type }
          : {}),
      },
    },
  });
}
