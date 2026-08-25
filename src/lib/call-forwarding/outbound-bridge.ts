import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { bridgeCalls } from "@/lib/smart-routing/telnyx-provider";
import { isBlockedCallbackDestination } from "@/lib/smart-routing/callback-destination-policy";
import { encodeCallForwardingOutboundState } from "./access-state";
import { resolveCallForwardingBusinessCallerId } from "./caller-id";
import { loadCallForwardingWorkspaceSettings } from "./workspace-settings";

function connectionId(): string {
  const id =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!id) throw new Error("TELNYX_CONNECTION_ID not configured");
  return id;
}

export async function createCallForwardingOutboundRecord(input: {
  workspaceId: string;
  authorizedCallerId?: string | null;
  employeePhoneE164: string;
  destinationE164: string;
  smsBody?: string | null;
  businessCallerIdE164?: string | null;
}) {
  const businessCallerId =
    input.businessCallerIdE164?.trim() ||
    (await resolveCallForwardingBusinessCallerId(input.workspaceId));
  return getPrisma().callForwardingOutboundCall.create({
    data: {
      workspaceId: input.workspaceId,
      authorizedCallerId: input.authorizedCallerId ?? null,
      employeePhoneE164: normalizeE164(input.employeePhoneE164),
      destinationE164: normalizeE164(input.destinationE164),
      businessCallerIdE164: businessCallerId ? normalizeE164(businessCallerId) : null,
      smsBody: input.smsBody ?? null,
      employeeLegStartedAt: new Date(),
      result: "initiated",
    },
  });
}

export async function originateCallForwardingEmployeeLeg(input: {
  workspaceId: string;
  outboundCallId: string;
  employeePhoneE164: string;
  fromE164: string;
}) {
  const prisma = getPrisma();
  if (!isTelnyxVoiceConfigured()) {
    await prisma.callForwardingOutboundCall.update({
      where: { id: input.outboundCallId },
      data: { result: "mock" },
    });
    return { mock: true as const };
  }

  const clientState = encodeCallForwardingOutboundState({
    kind: "call_forwarding_outbound",
    outboundCallId: input.outboundCallId,
    workspaceId: input.workspaceId,
    awaiting: "confirm",
  });

  const res = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId(),
      from: normalizeE164(input.fromE164),
      to: normalizeE164(input.employeePhoneE164),
      client_state: clientState,
    },
  });

  const employeeCallControlId = res?.data?.call_control_id ?? null;
  await prisma.callForwardingOutboundCall.update({
    where: { id: input.outboundCallId },
    data: {
      employeeCallControlId,
      result: "employee_ringing",
    },
  });
  return { employeeCallControlId };
}

export async function originateCallForwardingCustomerLeg(input: {
  workspaceId: string;
  outboundCallId: string;
  employeeCallControlId: string;
  destinationE164: string;
}) {
  const prisma = getPrisma();
  const outbound = await prisma.callForwardingOutboundCall.findUnique({
    where: { id: input.outboundCallId },
  });
  if (!outbound) throw new Error("Outbound call not found");

  const ws = await loadCallForwardingWorkspaceSettings(input.workspaceId);
  const internal = {
    routingNumberE164: ws?.businessNumberE164,
    callbackNumberE164: ws?.controlNumberE164,
  };
  if (isBlockedCallbackDestination(input.destinationE164, internal)) {
    throw new Error("Destination is not allowed");
  }

  const verifiedCallerId =
    outbound.businessCallerIdE164?.trim() ||
    (await resolveCallForwardingBusinessCallerId(input.workspaceId));
  if (!verifiedCallerId) throw new Error("Business caller ID is not configured");

  if (!isTelnyxVoiceConfigured()) {
    await prisma.callForwardingOutboundCall.update({
      where: { id: input.outboundCallId },
      data: { result: "mock", customerLegStartedAt: new Date() },
    });
    return { mock: true as const };
  }

  const clientState = encodeCallForwardingOutboundState({
    kind: "call_forwarding_outbound",
    outboundCallId: input.outboundCallId,
    workspaceId: input.workspaceId,
    awaiting: "bridging",
  });

  const res = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId(),
      from: normalizeE164(verifiedCallerId),
      to: normalizeE164(input.destinationE164),
      client_state: clientState,
    },
  });

  const customerCallControlId = res?.data?.call_control_id ?? null;
  await prisma.callForwardingOutboundCall.update({
    where: { id: input.outboundCallId },
    data: {
      customerCallControlId,
      customerLegStartedAt: new Date(),
      businessCallerIdE164: normalizeE164(verifiedCallerId),
      result: "customer_ringing",
    },
  });
  return { customerCallControlId };
}

export async function bridgeCallForwardingLegs(input: {
  employeeCallControlId: string;
  customerCallControlId: string;
  outboundCallId: string;
}) {
  const prisma = getPrisma();
  await bridgeCalls(input.employeeCallControlId, input.customerCallControlId);
  await prisma.callForwardingOutboundCall.update({
    where: { id: input.outboundCallId },
    data: { bridgedAt: new Date(), result: "bridged" },
  });
}

export async function finalizeCallForwardingOutbound(
  outboundCallId: string,
  result: string,
  durationSeconds?: number,
) {
  await getPrisma().callForwardingOutboundCall.update({
    where: { id: outboundCallId },
    data: {
      result,
      endedAt: new Date(),
      durationSeconds: durationSeconds ?? undefined,
    },
  });
}

export async function handleCallForwardingOutboundHangup(input: {
  outboundCallId: string;
  callControlId: string;
}) {
  const prisma = getPrisma();
  const outbound = await prisma.callForwardingOutboundCall.findUnique({
    where: { id: input.outboundCallId },
  });
  if (!outbound || outbound.result === "bridged" || outbound.result === "completed") return;

  const isEmployee = outbound.employeeCallControlId === input.callControlId;
  const isCustomer = outbound.customerCallControlId === input.callControlId;
  if (!isEmployee && !isCustomer) return;

  await finalizeCallForwardingOutbound(
    input.outboundCallId,
    isEmployee ? "employee_hangup" : "customer_hangup",
  );

  const otherId = isEmployee ? outbound.customerCallControlId : outbound.employeeCallControlId;
  if (otherId) {
    await telnyxRequest(`/calls/${otherId}/actions/hangup`, { method: "POST", body: {} }).catch(
      () => undefined,
    );
  }
}
