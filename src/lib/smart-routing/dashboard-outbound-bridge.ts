import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { isBlockedCallbackDestination } from "./callback-destination-policy";
import { encodeEmployeeAccessState } from "./employee-access-state";
import {
  createOutboundCallRecord,
  originateCustomerLeg,
  type OutboundContextType,
} from "./outbound-bridge";
import {
  loadSmartRoutingWorkspaceSettings,
  resolveVerifiedBusinessCallerId,
} from "./workspace-settings";

const MAX_OUTBOUND_PER_HOUR = Number(process.env.SR_OUTBOUND_MAX_PER_HOUR || "30");

function connectionId(): string {
  const id =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!id) throw new Error("TELNYX_CONNECTION_ID not configured");
  return id;
}

export function buildOutboundBridgeMetadata(input: {
  dialMethod: "last_call" | "manual" | "dashboard" | "pin_menu";
  accessNumberE164?: string | null;
  initiatedByUserId?: string | null;
  matchKind?: string | null;
}): Record<string, unknown> {
  return {
    dialMethod: input.dialMethod,
    ...(input.accessNumberE164 ? { accessNumberE164: input.accessNumberE164 } : {}),
    ...(input.initiatedByUserId ? { initiatedByUserId: input.initiatedByUserId } : {}),
    ...(input.matchKind ? { lastCallerMatchKind: input.matchKind } : {}),
  };
}

export async function initiateDashboardOutboundBridge(input: {
  workspaceId: string;
  authorizedCallerId: string;
  destinationE164: string;
  contextType: OutboundContextType;
  contextRefId?: string | null;
  initiatedByUserId?: string | null;
}) {
  const entitled = await hasWorkspaceProductFeature(input.workspaceId, "smart_routing");
  if (!entitled) throw new Error("Smart Routing is not enabled for this workspace");

  const settings = await loadSmartRoutingWorkspaceSettings(input.workspaceId);
  if (!settings?.outboundEnabled) {
    throw new Error("Business call back is disabled. Enable it in Smart Routing setup.");
  }

  const verifiedCallerId = await resolveVerifiedBusinessCallerId(input.workspaceId);
  if (!verifiedCallerId) {
    throw new Error("Verify your business caller ID before placing business call backs.");
  }

  const prisma = getPrisma();
  const authorizedCaller = await prisma.smartRoutingAuthorizedCaller.findFirst({
    where: {
      id: input.authorizedCallerId,
      workspaceId: input.workspaceId,
      active: true,
      outboundEnabled: true,
    },
  });
  if (!authorizedCaller) throw new Error("Authorized team member not found");

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.smartRoutingOutboundCall.count({
    where: { workspaceId: input.workspaceId, createdAt: { gte: hourAgo } },
  });
  if (recentCount >= MAX_OUTBOUND_PER_HOUR) {
    throw new Error("Outbound call limit reached for this hour. Try again later.");
  }

  const destination = normalizeE164(input.destinationE164);
  if (
    isBlockedCallbackDestination(destination, {
      routingNumberE164: settings.routingNumberE164,
      callbackNumberE164: settings.callbackNumberE164,
    })
  ) {
    throw new Error("That destination number is not allowed");
  }

  const employeePhone = normalizeE164(authorizedCaller.phoneE164);
  const fromNumber = settings.routingNumberE164 ?? verifiedCallerId;
  if (!fromNumber) throw new Error("Assign a routing number in Smart Routing setup");

  if (input.contextType === "callback_request" && input.contextRefId) {
    await prisma.callbackRequest.updateMany({
      where: {
        id: input.contextRefId,
        workspaceId: input.workspaceId,
        status: "new",
      },
      data: { status: "contacted", contactedAt: new Date() },
    });
  }

  const accessSession = await prisma.smartRoutingAccessSession.create({
    data: {
      workspaceId: input.workspaceId,
      callerNumber: employeePhone,
      calledNumber: normalizeE164(fromNumber),
      authorizedCallerId: input.authorizedCallerId,
      state: "dashboard_connect",
      pendingDestination: destination,
      contextType: input.contextType,
      contextRefId: input.contextRefId ?? null,
    },
  });

  const outbound = await createOutboundCallRecord({
    workspaceId: input.workspaceId,
    authorizedCallerId: input.authorizedCallerId,
    employeePhoneE164: employeePhone,
    destinationE164: destination,
    businessCallerIdE164: verifiedCallerId,
    contextType: input.contextType,
    contextRefId: input.contextRefId,
    metadata: buildOutboundBridgeMetadata({
      dialMethod: "dashboard",
      accessNumberE164: fromNumber,
      initiatedByUserId: input.initiatedByUserId,
    }),
  });

  const { isTelnyxVoiceConfigured } = await import("@/lib/voice/telnyx/assistant-sync");
  if (!isTelnyxVoiceConfigured()) {
    await prisma.smartRoutingOutboundCall.update({
      where: { id: outbound.id },
      data: { result: "mock", customerLegStartedAt: new Date() },
    });
    return { outboundCallId: outbound.id, accessSessionId: accessSession.id, mock: true };
  }

  const clientState = encodeEmployeeAccessState({
    kind: "smart_routing_employee",
    accessSessionId: accessSession.id,
    workspaceId: input.workspaceId,
    awaiting: "dashboard_connect",
    outboundCallId: outbound.id,
  });

  const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
  const res = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId(),
      from: normalizeE164(fromNumber),
      to: employeePhone,
      client_state: clientState,
    },
  });

  const employeeCallControlId = res?.data?.call_control_id ?? null;
  await prisma.smartRoutingAccessSession.update({
    where: { id: accessSession.id },
    data: { callControlId: employeeCallControlId },
  });
  await prisma.smartRoutingOutboundCall.update({
    where: { id: outbound.id },
    data: { employeeCallControlId },
  });

  return {
    outboundCallId: outbound.id,
    accessSessionId: accessSession.id,
    employeeCallControlId,
  };
}

export async function handleDashboardEmployeeAnswered(input: {
  callControlId: string;
  accessSessionId: string;
  workspaceId: string;
  outboundCallId: string;
}) {
  const prisma = getPrisma();
  const access = await prisma.smartRoutingAccessSession.findFirst({
    where: { id: input.accessSessionId, workspaceId: input.workspaceId },
  });
  if (!access?.pendingDestination) return;

  await prisma.smartRoutingAccessSession.update({
    where: { id: access.id },
    data: { callControlId: input.callControlId, state: "bridging" },
  });

  const { speakOnCallRaw } = await import("./telnyx-provider");
  await speakOnCallRaw(input.callControlId, "Please hold while we connect your call.");

  const settings = await loadSmartRoutingWorkspaceSettings(input.workspaceId);
  await originateCustomerLeg({
    workspaceId: input.workspaceId,
    accessSessionId: access.id,
    outboundCallId: input.outboundCallId,
    employeeCallControlId: input.callControlId,
    destinationE164: access.pendingDestination,
    fromRoutingE164: settings?.routingNumberE164 ?? access.calledNumber,
  });
}
