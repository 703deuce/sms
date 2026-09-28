import { getPrisma } from "@/lib/db";

export type MctbConversationUrgencyContext = {
  isUrgent: boolean;
  reason?: string | null;
  summary?: string | null;
  messagePreview?: string | null;
  assessedAt?: string | null;
  ruleVersion?: string | null;
};

function parseUrgentFromCaptured(captured: unknown): MctbConversationUrgencyContext | null {
  if (!captured || typeof captured !== "object") return null;
  const raw = (captured as Record<string, unknown>)._mctb_urgent_latest;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    isUrgent: true,
    reason: typeof o.reason === "string" ? o.reason : null,
    summary: typeof o.summary === "string" ? o.summary : null,
    messagePreview: typeof o.messagePreview === "string" ? o.messagePreview : null,
    assessedAt: typeof o.at === "string" ? o.at : null,
    ruleVersion: typeof o.ruleVersion === "string" ? o.ruleVersion : null,
  };
}

/** Latest urgent classification for MCTB Conversations (list + thread). */
export async function loadMctbConversationUrgencyMap(
  workspaceId: string,
  conversationIds: string[],
): Promise<Map<string, MctbConversationUrgencyContext>> {
  const ids = [...new Set(conversationIds.filter(Boolean))];
  const out = new Map<string, MctbConversationUrgencyContext>();
  if (!ids.length) return out;

  const prisma = getPrisma();
  const [automationRows, assessmentRows] = await Promise.all([
    prisma.mctbConversationAutomationState.findMany({
      where: { workspaceId, conversationId: { in: ids } },
      select: { conversationId: true, state: true, capturedFieldsJson: true },
    }),
    prisma.mctbUrgencyAssessment.findMany({
      where: { workspaceId, conversationId: { in: ids }, classification: "urgent" },
      orderBy: { createdAt: "desc" },
      select: {
        conversationId: true,
        reason: true,
        customerText: true,
        ruleVersion: true,
        createdAt: true,
      },
    }),
  ]);

  for (const row of automationRows) {
    const fromCaptured = parseUrgentFromCaptured(row.capturedFieldsJson);
    if (fromCaptured) {
      out.set(row.conversationId, fromCaptured);
      continue;
    }
    if (row.state === "urgent") {
      out.set(row.conversationId, { isUrgent: true });
    }
  }

  for (const a of assessmentRows) {
    if (!a.conversationId || out.has(a.conversationId)) continue;
    out.set(a.conversationId, {
      isUrgent: true,
      reason: a.reason,
      messagePreview: a.customerText?.slice(0, 400) ?? null,
      assessedAt: a.createdAt.toISOString(),
      ruleVersion: a.ruleVersion,
    });
  }

  return out;
}

export async function loadMctbConversationUrgency(
  workspaceId: string,
  conversationId: string,
): Promise<MctbConversationUrgencyContext | null> {
  const map = await loadMctbConversationUrgencyMap(workspaceId, [conversationId]);
  return map.get(conversationId) ?? null;
}
