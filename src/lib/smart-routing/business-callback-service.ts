import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { OutboundContextType } from "./outbound-bridge";
import {
  businessCallbackStatusLabel,
  mapOutboundResultToUiStatus,
  type BusinessCallbackUiStatus,
} from "./business-callback-status";

export type InitiateBusinessCallbackInput = {
  workspaceId: string;
  authorizedCallerId: string;
  destinationE164: string;
  contextType: OutboundContextType;
  contextRefId?: string | null;
  initiatedByUserId?: string | null;
  destinationContactName?: string | null;
};

export async function findActiveOutboundForUser(
  workspaceId: string,
  initiatedByUserId: string,
) {
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
          "awaiting_confirmation",
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
  const uiStatus = mapOutboundResultToUiStatus(row.result, row.bridgedAt, row.endedAt);
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
    metadata: row.metadata,
  };
}

export async function initiateOneClickBusinessCallback(input: InitiateBusinessCallbackInput) {
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

  const { initiateDashboardOutboundBridge } = await import("./dashboard-outbound-bridge");
  const result = await initiateDashboardOutboundBridge({
    workspaceId: input.workspaceId,
    authorizedCallerId: input.authorizedCallerId,
    destinationE164: input.destinationE164,
    contextType: input.contextType,
    contextRefId: input.contextRefId,
    initiatedByUserId: input.initiatedByUserId,
    destinationContactName: input.destinationContactName,
  });
  return { ...result, alreadyActive: false };
}

export { resolveAuthorizedCallerCallbackPhone, formatCallbackPromptDestination } from "./business-callback-status";
export type { BusinessCallbackUiStatus };
