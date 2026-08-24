import "server-only";

import { createHash, randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import {
  type InitiateBusinessCallbackInput,
  mapContextTypeFromSource,
} from "./business-callback-types";
import { resolveCallbackCallerIdE164 } from "./caller-id-resolver";
import { resolveAuthorizedCallerCallbackPhone } from "./business-callback-status";
import type { OutboundContextType } from "./outbound-bridge";

export async function findActiveOutboundForUser(workspaceId: string, initiatedByUserId: string) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - 3 * 60 * 1000);
  const rows = await prisma.smartRoutingOutboundCall.findMany({
    where: {
      workspaceId,
      createdAt: { gte: since },
      result: {
        in: [
          "initiated",
          "employee_ringing",
          "employee_answered",
          "awaiting_confirmation",
          "awaiting_employee_confirmation",
          "employee_confirmed",
          "customer_ringing",
          "bridged",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.find((row: { metadata: unknown }) => {
    const meta = row.metadata as { initiatedByUserId?: string } | null;
    return meta?.initiatedByUserId === initiatedByUserId;
  });
}

export async function getBusinessCallbackStatus(outboundCallId: string, workspaceId: string) {
  const prisma = getPrisma();
  const row = await prisma.smartRoutingOutboundCall.findFirst({
    where: { id: outboundCallId, workspaceId },
    include: { authorizedCaller: { select: { name: true } } },
  });
  if (!row) return null;
  const { mapOutboundResultToUiStatus, businessCallbackStatusLabel } = await import(
    "./business-callback-status"
  );
  const uiStatus = mapOutboundResultToUiStatus(row.result, row.bridgedAt, row.endedAt);
  const meta = row.metadata as Record<string, unknown> | null;
  return {
    id: row.id,
    result: row.result,
    uiStatus,
    statusLabel: businessCallbackStatusLabel(uiStatus),
    destinationE164: row.destinationE164,
    employeePhoneE164: row.employeePhoneE164,
    businessCallerIdE164: row.businessCallerIdE164,
    bridgedAt: row.bridgedAt,
    endedAt: row.endedAt,
    durationSeconds: row.durationSeconds,
    authorizedCallerName: row.authorizedCaller?.name ?? null,
    initiationMethod: meta?.initiationMethod ?? null,
    sourceType: meta?.sourceType ?? row.contextType,
    destinationContactName: meta?.destinationContactName ?? null,
    metadata: row.metadata,
  };
}

/**
 * Canonical outbound business callback entry point.
 * All dashboard, employee-link, PIN, and call-again flows must use this.
 */
export async function initiateBusinessCallback(input: InitiateBusinessCallbackInput) {
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

  const employeePhone =
    input.employeeCallbackE164?.trim()
      ? input.employeeCallbackE164
      : resolveAuthorizedCallerCallbackPhone(authorizedCaller);

  const businessCallerId =
    input.businessCallerIdE164?.trim() ||
    (await resolveCallbackCallerIdE164({
      workspaceId: input.workspaceId,
      originalInboundSessionId: input.originalInboundSessionId,
      authorizedCallerDefaultE164: authorizedCaller.defaultBusinessCallerIdE164,
    }));

  const contextType: OutboundContextType = mapContextTypeFromSource(input.sourceType);
  const contextRefId =
    input.sourceId ??
    input.originalInboundSessionId ??
    (input.previousOutboundCallId ? input.previousOutboundCallId : null);

  if (input.initiatedByUserId) {
    const active = await findActiveOutboundForUser(input.workspaceId, input.initiatedByUserId);
    if (active) {
      return {
        outboundCallId: active.id,
        accessSessionId: null as string | null,
        alreadyActive: true,
      };
    }
  }

  const { initiateDashboardOutboundBridge, buildOutboundBridgeMetadata } = await import(
    "./dashboard-outbound-bridge"
  );

  const dialMethod =
    input.initiationMethod === "call_in_pin"
      ? "pin_menu"
      : input.initiationMethod === "employee_link"
        ? "dashboard"
        : input.initiationMethod === "call_again"
          ? "dashboard"
          : "dashboard";

  const result = await initiateDashboardOutboundBridge({
    workspaceId: input.workspaceId,
    authorizedCallerId: input.authorizedCallerId,
    destinationE164: input.destinationE164,
    contextType,
    contextRefId,
    initiatedByUserId: input.initiatedByUserId,
    destinationContactName: input.destinationContactName,
    employeePhoneE164: employeePhone,
    businessCallerIdE164: businessCallerId,
    bridgeMetadata: {
      ...buildOutboundBridgeMetadata({
        dialMethod,
        initiatedByUserId: input.initiatedByUserId,
        destinationContactName: input.destinationContactName,
      }),
      initiationMethod: input.initiationMethod,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      originalInboundSessionId: input.originalInboundSessionId ?? null,
      previousOutboundCallId: input.previousOutboundCallId ?? null,
    },
  });

  return { ...result, alreadyActive: false };
}

/** @deprecated Use initiateBusinessCallback */
export async function initiateOneClickBusinessCallback(input: {
  workspaceId: string;
  authorizedCallerId: string;
  destinationE164: string;
  contextType: OutboundContextType;
  contextRefId?: string | null;
  initiatedByUserId?: string | null;
  destinationContactName?: string | null;
}) {
  return initiateBusinessCallback({
    workspaceId: input.workspaceId,
    authorizedCallerId: input.authorizedCallerId,
    destinationE164: input.destinationE164,
    sourceType:
      input.contextType === "activity"
        ? "routing_activity"
        : input.contextType === "missed_call"
          ? "missed_call"
          : input.contextType === "conversation"
            ? "conversation"
            : input.contextType === "voicemail"
              ? "voicemail"
              : input.contextType === "callback_request"
                ? "callback_request"
                : "manual",
    sourceId: input.contextRefId,
    initiationMethod: "dashboard_ringout",
    initiatedByUserId: input.initiatedByUserId,
    destinationContactName: input.destinationContactName,
    originalInboundSessionId:
      input.contextType === "activity" ? input.contextRefId : undefined,
  });
}

export {
  resolveAuthorizedCallerCallbackPhone,
  formatCallbackPromptDestination,
} from "./business-callback-status";
export type { BusinessCallbackUiStatus } from "./business-callback-status";
