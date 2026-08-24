import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { bridgeCalls } from "./telnyx-provider";
import { resolveVerifiedBusinessCallerId } from "./workspace-settings";
import { isBlockedCallbackDestination } from "./callback-destination-policy";

export type OutboundContextType =
  | "last_call"
  | "missed_call"
  | "voicemail"
  | "callback_request"
  | "manual"
  | "dashboard"
  | "activity"
  | "conversation";

import {
  encodeEmployeeAccessState,
} from "./employee-access-state";

function connectionId(): string {
  const id =
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim();
  if (!id) throw new Error("TELNYX_CONNECTION_ID not configured");
  return id;
}

export async function createOutboundCallRecord(input: {
  workspaceId: string;
  authorizedCallerId?: string | null;
  employeePhoneE164: string;
  destinationE164: string;
  businessCallerIdE164?: string | null;
  contextType: OutboundContextType;
  contextRefId?: string | null;
  employeeCallControlId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  return prisma.smartRoutingOutboundCall.create({
    data: {
      workspaceId: input.workspaceId,
      authorizedCallerId: input.authorizedCallerId ?? null,
      employeePhoneE164: normalizeE164(input.employeePhoneE164),
      destinationE164: normalizeE164(input.destinationE164),
      businessCallerIdE164: input.businessCallerIdE164
        ? normalizeE164(input.businessCallerIdE164)
        : null,
      contextType: input.contextType,
      contextRefId: input.contextRefId ?? null,
      employeeCallControlId: input.employeeCallControlId ?? null,
      employeeLegStartedAt: new Date(),
      result: "initiated",
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function originateCustomerLeg(input: {
  workspaceId: string;
  accessSessionId: string;
  outboundCallId: string;
  employeeCallControlId: string;
  destinationE164: string;
  fromRoutingE164: string;
}) {
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const routingNumber = settings?.routingNumberE164 ?? input.fromRoutingE164;
  if (
    isBlockedCallbackDestination(input.destinationE164, {
      routingNumberE164: settings?.routingNumberE164,
      callbackNumberE164: settings?.callbackNumberE164,
    })
  ) {
    throw new Error("Destination is not allowed");
  }

  const verifiedCallerId =
    (
      await prisma.smartRoutingOutboundCall.findUnique({
        where: { id: input.outboundCallId },
        select: { businessCallerIdE164: true },
      })
    )?.businessCallerIdE164?.trim() ||
    (await resolveVerifiedBusinessCallerId(input.workspaceId));
  if (!verifiedCallerId) {
    throw new Error("Business caller ID is not verified");
  }

  if (!isTelnyxVoiceConfigured()) {
    await prisma.smartRoutingOutboundCall.update({
      where: { id: input.outboundCallId },
      data: { result: "mock", customerLegStartedAt: new Date() },
    });
    return { mock: true };
  }

  const clientState = encodeEmployeeAccessState({
    kind: "smart_routing_employee",
    accessSessionId: input.accessSessionId,
    workspaceId: input.workspaceId,
    outboundCallId: input.outboundCallId,
  });

  const res = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId(),
      from: verifiedCallerId,
      to: normalizeE164(input.destinationE164),
      client_state: clientState,
    },
  });

  const customerCallControlId = res?.data?.call_control_id ?? null;
  await prisma.smartRoutingOutboundCall.update({
    where: { id: input.outboundCallId },
    data: {
      customerCallControlId,
      customerLegStartedAt: new Date(),
      businessCallerIdE164: verifiedCallerId,
      result: "customer_ringing",
    },
  });
  await prisma.smartRoutingAccessSession.update({
    where: { id: input.accessSessionId },
    data: { customerCallControlId, state: "bridging" },
  });

  return { customerCallControlId };
}

export async function bridgeEmployeeToCustomer(input: {
  employeeCallControlId: string;
  customerCallControlId: string;
  outboundCallId: string;
}) {
  const prisma = getPrisma();
  const outbound = await prisma.smartRoutingOutboundCall.findUnique({
    where: { id: input.outboundCallId },
  });
  if (outbound) {
    const { maybePlayRecordingAnnouncement } = await import("./recording-announcement");
    await maybePlayRecordingAnnouncement({
      workspaceId: outbound.workspaceId,
      customerCallControlId: input.customerCallControlId,
      direction: "outbound",
    });
  }

  await bridgeCalls(input.employeeCallControlId, input.customerCallControlId);
  await prisma.smartRoutingOutboundCall.update({
    where: { id: input.outboundCallId },
    data: { bridgedAt: new Date(), result: "bridged" },
  });

  if (outbound) {
    const { registerConnectedCallControl } = await import("./call-control-service");
    await registerConnectedCallControl({
      workspaceId: outbound.workspaceId,
      callSessionId: outbound.contextRefId ?? outbound.id,
      employeeCallControlId: input.employeeCallControlId,
      customerCallControlId: input.customerCallControlId,
      employeePhoneE164: outbound.employeePhoneE164,
    });
  }
}

export async function finalizeOutboundCall(
  outboundCallId: string,
  result: string,
  failureReason?: string | null,
) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingOutboundCall.findUnique({ where: { id: outboundCallId } });
  if (!row) return;
  if (row.endedAt) return;
  const endedAt = new Date();
  const start = row.bridgedAt ?? row.customerLegStartedAt ?? row.employeeLegStartedAt;
  const durationSeconds = start
    ? Math.max(0, Math.round((endedAt.getTime() - start.getTime()) / 1000))
    : null;
  const reason = failureReason ?? undefined;
  const metadata =
    reason
      ? {
          ...(typeof row.metadata === "object" && row.metadata
            ? (row.metadata as Record<string, unknown>)
            : {}),
          failureReason: reason,
        }
      : undefined;
  await prisma.smartRoutingOutboundCall.update({
    where: { id: outboundCallId },
    data: {
      endedAt,
      result,
      durationSeconds,
      ...(metadata ? { metadata } : {}),
    },
  });
}

export async function cancelCustomerLegIfActive(outboundCallId: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingOutboundCall.findUnique({ where: { id: outboundCallId } });
  if (!row?.customerCallControlId || row.bridgedAt) return;
  const { hangupCall } = await import("./telnyx-provider");
  try {
    await hangupCall(row.customerCallControlId);
  } catch {
    // leg may already be down
  }
}

export async function handleOutboundLegHangup(input: {
  outboundCallId: string;
  callControlId: string;
  hangupCause?: string | null;
}) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingOutboundCall.findUnique({ where: { id: input.outboundCallId } });
  if (!row || row.endedAt) return;

  const isEmployeeLeg = row.employeeCallControlId === input.callControlId;
  const isCustomerLeg = row.customerCallControlId === input.callControlId;

  if (isEmployeeLeg) {
    await cancelCustomerLegIfActive(input.outboundCallId);
    if (row.bridgedAt) {
      await finalizeOutboundCall(input.outboundCallId, "completed");
      return;
    }
    const prior = (row.result ?? "").toLowerCase();
    if (prior === "awaiting_confirmation") {
      await finalizeOutboundCall(
        input.outboundCallId,
        "employee_confirmation_timeout",
        input.hangupCause,
      );
      return;
    }
    if (prior === "employee_ringing" || prior === "initiated") {
      await finalizeOutboundCall(input.outboundCallId, "employee_no_answer", input.hangupCause);
      return;
    }
    await finalizeOutboundCall(input.outboundCallId, "cancelled", input.hangupCause);
    return;
  }

  if (isCustomerLeg) {
    if (row.bridgedAt) {
      await finalizeOutboundCall(input.outboundCallId, "completed");
      return;
    }
    const cause = (input.hangupCause ?? "").toLowerCase();
    if (cause.includes("busy")) {
      await finalizeOutboundCall(input.outboundCallId, "customer_busy", input.hangupCause);
    } else if (cause.includes("reject")) {
      await finalizeOutboundCall(input.outboundCallId, "customer_rejected", input.hangupCause);
    } else {
      await finalizeOutboundCall(input.outboundCallId, "customer_no_answer", input.hangupCause);
    }
    const { hangupCall } = await import("./telnyx-provider");
    if (row.employeeCallControlId) {
      try {
        await hangupCall(row.employeeCallControlId);
      } catch {
        // ignore
      }
    }
    return;
  }
}
