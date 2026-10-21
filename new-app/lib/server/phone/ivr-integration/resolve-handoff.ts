import "server-only";

import { getPrisma } from "@/lib/server/db";
import type { PhoneIvrHandoffContext } from "./handoff-stages";

type SessionState = {
  integratedHandoff?: PhoneIvrHandoffContext;
  liveSessionId?: string;
  livekitSipLegControlId?: string;
  inboundCallControlId?: string;
};

export async function findActivePhoneHandoffByLiveSession(
  liveSessionId: string,
): Promise<{
  routingSessionId: string;
  handoff: PhoneIvrHandoffContext;
  state: SessionState;
} | null> {
  const prisma = getPrisma();
  const recent = await prisma.phoneCallRoutingSession.findMany({
    where: {
      updatedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  for (const row of recent) {
    const state = (row.stateJson || {}) as SessionState;
    if (state.liveSessionId === liveSessionId && state.integratedHandoff) {
      return {
        routingSessionId: row.id,
        handoff: state.integratedHandoff,
        state,
      };
    }
  }
  return null;
}

export async function linkLiveSessionToPhoneRouting(input: {
  liveSessionId: string;
  workspaceId: string;
  phoneNumberId: string;
  callerE164: string | null | undefined;
}): Promise<string | null> {
  const prisma = getPrisma();
  const caller = input.callerE164?.trim();
  const sessions = await prisma.phoneCallRoutingSession.findMany({
    where: {
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      stage: { in: ["conversational_ivr", "ivr_group_transfer", "phone_group_transfer"] },
      updatedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  for (const row of sessions) {
    if (caller && row.humanCallId) {
      const hc = await prisma.humanCall.findUnique({
        where: { id: row.humanCallId },
        select: { from: true },
      });
      if (hc?.from && hc.from !== caller) continue;
    }
    const state = (row.stateJson || {}) as SessionState;
    if (state.liveSessionId && state.liveSessionId !== input.liveSessionId) continue;
    const { patchRoutingSessionState } = await import("@/lib/server/phone/routing/session-state");
    await patchRoutingSessionState(row.id, { liveSessionId: input.liveSessionId });
    return row.id;
  }
  return null;
}
