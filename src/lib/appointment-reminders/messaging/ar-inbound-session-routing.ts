import type { ArSmsReplySession } from "@/lib/domain";

const PRIMARY_SESSION_PRIORITY: Record<string, number> = {
  RESCHEDULING: 0,
  AWAITING_CANCEL_CONFIRM: 1,
  AWAITING_STAFF_APPROVAL: 2,
  AWAITING_REPLY: 3,
  NEEDS_CLARIFICATION: 4,
  COMPLETED: 5,
};

/**
 * Pick the session that should own this inbound turn (not "win" other appointments).
 * Prefer an in-flight reschedule; never auto-expire sibling sessions.
 */
export function pickPrimaryArReplySessionForInbound(sessions: ArSmsReplySession[]): ArSmsReplySession | null {
  if (!sessions.length) return null;
  const sorted = [...sessions].sort((a, b) => {
    const pa = PRIMARY_SESSION_PRIORITY[a.lifecycleState] ?? 50;
    const pb = PRIMARY_SESSION_PRIORITY[b.lifecycleState] ?? 50;
    if (pa !== pb) return pa - pb;
    const ta = a.lastUsedAt?.getTime() ?? 0;
    const tb = b.lastUsedAt?.getTime() ?? 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

export function groupArSessionsByWorkspace(
  sessions: ArSmsReplySession[],
): Map<string, ArSmsReplySession[]> {
  const map = new Map<string, ArSmsReplySession[]>();
  for (const s of sessions) {
    const list = map.get(s.workspaceId) ?? [];
    list.push(s);
    map.set(s.workspaceId, list);
  }
  return map;
}

export type ArInboundPrimarySessionResolution =
  | { status: "ok"; session: ArSmsReplySession }
  | {
      status: "ambiguous_appointment";
      appointmentIds: string[];
      tiedSessions: ArSmsReplySession[];
    };

/**
 * Pick inbound session or fail closed when multiple appointments tie at the same lifecycle priority.
 * Recency (lastUsedAt) must not disambiguate two AWAITING_REPLY sessions for different appointments.
 */
export function resolveArInboundPrimarySession(
  sessions: ArSmsReplySession[],
): ArInboundPrimarySessionResolution | { status: "none" } {
  const primary = pickPrimaryArReplySessionForInbound(sessions);
  if (!primary) return { status: "none" };

  const priority = PRIMARY_SESSION_PRIORITY[primary.lifecycleState] ?? 50;
  const tied = sessions.filter((s) => (PRIMARY_SESSION_PRIORITY[s.lifecycleState] ?? 50) === priority);
  const appointmentIds = [...new Set(tied.map((s) => s.appointmentId))];
  if (appointmentIds.length > 1) {
    // Multiple appointments at the same active priority (e.g. two AWAITING_REPLY) — fail closed.
    // Post-complete chatter (thanks, follow-up questions): all tied sessions are terminal — use the
    // most recently used session (primary) so Context + Appointment agents can respond naturally.
    const allTerminalAtThisPriority = tied.every(
      (s) => s.lifecycleState === "COMPLETED" || s.lifecycleState === "EXPIRED",
    );
    if (allTerminalAtThisPriority && priority >= PRIMARY_SESSION_PRIORITY.COMPLETED) {
      return { status: "ok", session: primary };
    }
    return { status: "ambiguous_appointment", appointmentIds, tiedSessions: tied };
  }
  return { status: "ok", session: primary };
}
