import { getPrisma } from "@/lib/server/db";

const MAX_MENU_DEPTH = 3;

export function maxMenuDepth() {
  return MAX_MENU_DEPTH;
}

export async function loadRoutingSession(sessionId: string) {
  return getPrisma().phoneCallRoutingSession.findUnique({
    where: { id: sessionId },
    include: { legs: true },
  });
}

export async function patchRoutingSessionState(
  sessionId: string,
  patch: Record<string, unknown>,
) {
  const row = await getPrisma().phoneCallRoutingSession.findUnique({ where: { id: sessionId } });
  if (!row) return null;
  const prev = (row.stateJson || {}) as Record<string, unknown>;
  return getPrisma().phoneCallRoutingSession.update({
    where: { id: sessionId },
    data: { stateJson: { ...prev, ...patch } as object },
  });
}

/** First outbound leg to claim the bridge wins (simultaneous ring). */
export async function claimSimultaneousWinner(
  sessionId: string,
  outboundControlId: string,
): Promise<boolean> {
  const row = await getPrisma().phoneCallRoutingSession.findUnique({ where: { id: sessionId } });
  if (!row) return false;
  const state = (row.stateJson || {}) as { bridgeWinnerControlId?: string };
  if (state.bridgeWinnerControlId) {
    return state.bridgeWinnerControlId === outboundControlId;
  }
  await getPrisma().phoneCallRoutingSession.update({
    where: { id: sessionId },
    data: {
      stateJson: {
        ...state,
        bridgeWinnerControlId: outboundControlId,
        bridgeClaimedAt: new Date().toISOString(),
      } as object,
    },
  });
  return true;
}

export function menuDepthFromState(clientState: Record<string, unknown>) {
  const d = clientState.menuDepth;
  return typeof d === "number" ? d : 0;
}

export function canOpenNestedMenu(clientState: Record<string, unknown>) {
  return menuDepthFromState(clientState) < MAX_MENU_DEPTH;
}

export async function getCallContextFromSession(sessionId: string) {
  const session = await loadRoutingSession(sessionId);
  if (!session?.humanCallId) return null;
  const call = await getPrisma().humanCall.findUnique({ where: { id: session.humanCallId } });
  if (!call) return null;
  return {
    workspaceId: session.workspaceId,
    humanCallId: call.id,
    phoneNumberId: call.phoneNumberId,
    businessLineE164: call.to,
    callerE164: call.from,
    inboundControlId: session.inboundCallControlId,
  };
}
