import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { findLastRoutedCallerForEmployee } from "./last-caller-for-employee";
import { isMissedRoutedOutcomeForEmployee } from "./last-caller-heuristics";

export type RecentBusinessCaller = {
  callerE164: string;
  contactName?: string | null;
  sessionId: string;
  calledAt: Date;
  rank: number;
};

const MAX_RECENT = 5;
const LOOKBACK_DAYS = Number(process.env.SR_LAST_CALLER_LOOKBACK_DAYS || "14");

function phonesMatch(a: string, b: string): boolean {
  try {
    return normalizeE164(a) === normalizeE164(b);
  } catch {
    return false;
  }
}

/**
 * Employee-scoped recent business callers for PIN menu and employee mini-page.
 */
export async function findRecentBusinessCallersForEmployee(input: {
  workspaceId: string;
  employeePhoneE164: string;
  limit?: number;
}): Promise<RecentBusinessCaller[]> {
  const prisma = getPrisma();
  const employeePhone = normalizeE164(input.employeePhoneE164);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const limit = Math.min(input.limit ?? MAX_RECENT, MAX_RECENT);
  const seen = new Set<string>();
  const results: RecentBusinessCaller[] = [];

  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const blocked = [
    employeePhone,
    settings?.routingNumberE164,
    settings?.callbackNumberE164,
    settings?.publicBusinessE164,
  ].filter(Boolean) as string[];

  const sessions = await prisma.smartRoutingCallSession.findMany({
    where: {
      workspaceId: input.workspaceId,
      isTest: false,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 150,
    select: {
      id: true,
      callerNumber: true,
      calledNumber: true,
      finalOutcome: true,
      startedAt: true,
    },
  });

  const receipts = await prisma.smartRoutingCommandReceipt.findMany({
    where: {
      providerCommand: { in: ["ring_group_dial", "whisper_dial"] },
      createdAt: { gte: since },
      callSession: { workspaceId: input.workspaceId, isTest: false },
    },
    select: {
      requestJson: true,
      providerCommand: true,
      callSessionId: true,
    },
  });

  const sessionEmployeeMap = new Map<string, boolean>();
  for (const r of receipts) {
    const req = r.requestJson as Record<string, unknown> | null;
    let phones: string[] = [];
    if (r.providerCommand === "ring_group_dial") {
      phones = (req?.targets as string[] | undefined) ?? [];
    } else if (r.providerCommand === "whisper_dial") {
      const to = req?.to as string | undefined;
      if (to) phones = [to];
    }
    if (phones.some((p) => phonesMatch(p, employeePhone))) {
      sessionEmployeeMap.set(r.callSessionId, true);
    }
  }

  for (const session of sessions) {
    if (!session.callerNumber) continue;
    if (blocked.some((b) => phonesMatch(b, session.callerNumber))) continue;
    if (!sessionEmployeeMap.get(session.id)) continue;
    if (!isMissedRoutedOutcomeForEmployee(session.finalOutcome)) continue;

    try {
      const caller = normalizeE164(session.callerNumber);
      if (seen.has(caller)) continue;
      seen.add(caller);
      results.push({
        callerE164: caller,
        sessionId: session.id,
        calledAt: session.startedAt,
        rank: results.length + 1,
      });
      if (results.length >= limit) break;
    } catch {
      continue;
    }
  }

  return results;
}

export async function resolveLastCallerForEmployee(input: {
  workspaceId: string;
  employeePhoneE164: string;
  authorizedCallerId?: string | null;
}) {
  const direct = await findLastRoutedCallerForEmployee(input);
  if (direct) return direct;

  const prisma = getPrisma();
  if (input.authorizedCallerId) {
    const caller = await prisma.smartRoutingAuthorizedCaller.findFirst({
      where: { id: input.authorizedCallerId, workspaceId: input.workspaceId },
      select: { userId: true },
    });
    const callback = await prisma.callbackRequest.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: { in: ["new", "contacted"] },
        ...(caller?.userId ? { assignedToUserId: caller.userId } : {}),
      },
      orderBy: { requestedAt: "desc" },
    });
    if (callback?.callerE164) {
      return {
        callerE164: callback.callerE164,
        sessionId: callback.smartRoutingSessionId ?? callback.id,
        matchedAt: callback.requestedAt,
        matchKind: "callback_request" as const,
      };
    }
  }

  return null;
}
