/** Pure helpers for consent log — safe to import from tests. */

export function missedCallIdempotencyKey(workspaceId: string, callSessionId: string): string {
  return `missed-call-text:${workspaceId}:${callSessionId}`;
}

export function asConsentMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type ConsentLogMissedLink = {
  id: string;
  status: string;
  smsSentAt: Date | null;
};

/** Session IDs + missed-call links for consent rows visible in a workspace. */
export function buildConsentLogScopeFromMissedEvents(
  workspaceId: string,
  missedEvents: Array<{
    id: string;
    status: string;
    smsSentAt: Date | null;
    idempotencyKey: string | null;
    metadata: unknown;
  }>,
): {
  sessionIds: string[];
  missedBySession: Map<string, ConsentLogMissedLink>;
} {
  const sessionIds = new Set<string>();
  const missedBySession = new Map<string, ConsentLogMissedLink>();

  const link = (sessionId: string, evt: ConsentLogMissedLink) => {
    sessionIds.add(sessionId);
    if (!missedBySession.has(sessionId)) {
      missedBySession.set(sessionId, evt);
    }
  };

  for (const evt of missedEvents) {
    const row: ConsentLogMissedLink = {
      id: evt.id,
      status: evt.status,
      smsSentAt: evt.smsSentAt,
    };
    const meta = asConsentMetadata(evt.metadata);
    const providerCallId =
      typeof meta.providerCallId === "string" ? meta.providerCallId.trim() : "";
    if (providerCallId) {
      link(providerCallId, row);
    }
    const prefix = `missed-call-text:${workspaceId}:`;
    if (evt.idempotencyKey?.startsWith(prefix)) {
      const sessionId = evt.idempotencyKey.slice(prefix.length);
      if (sessionId) link(sessionId, row);
    }
  }

  return { sessionIds: [...sessionIds], missedBySession };
}

export function buildConsentLogWhereClause(
  workspaceId: string,
  sessionIds: string[],
  callerFilter?: string,
): Record<string, unknown> {
  const or: Array<Record<string, unknown>> = [{ workspaceId }];
  if (sessionIds.length > 0) {
    or.push({ callSessionId: { in: sessionIds } });
  }
  const where: Record<string, unknown> = { OR: or };
  const digits = callerFilter?.replace(/\D/g, "") ?? "";
  if (digits) {
    where.callerNumber = { contains: digits };
  }
  return where;
}
