import "server-only";

import { getPrisma } from "@/lib/db";
import { AR_SMS_IDEMPOTENCY_PREFIX } from "@/lib/appointment-reminders/messaging/constants";
import { appendArConversationOutboundMessage } from "@/lib/appointment-reminders/messaging/persistent-conversation";

export type ArConversationThreadMessageHydrated = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  body: string;
  createdAt: string;
  deliveryStatus?: string | null;
  label?: string | null;
  providerMessageId?: string | null;
};

const MAX_LEDGER_ROWS = 40;

function reminderIdempotencyPrefix(workspaceId: string, appointmentId: string): string {
  return `${AR_SMS_IDEMPOTENCY_PREFIX}reminder:${workspaceId}:${appointmentId}:`;
}

function isProvenProviderMessageId(providerId: string | null | undefined): boolean {
  const id = (providerId || "").trim();
  if (!id) return false;
  if (id.startsWith("idem:")) return false;
  if (id.startsWith("pending:")) return false;
  return true;
}

function isProvenOutboundLedgerRow(row: {
  status: string;
  providerId: string | null;
  body: string;
}): boolean {
  if (row.status === "failed") return false;
  const body = row.body?.trim();
  if (!body) return false;
  return isProvenProviderMessageId(row.providerId);
}

/**
 * Outbound SMS rows that were accepted by the provider for this appointment (Message ledger).
 * Does not include timeline-only metadata or unsent/pending provider ids.
 */
export async function loadProvenArAppointmentOutboundLedger(input: {
  workspaceId: string;
  appointmentId: string;
  replySessionId?: string | null;
}): Promise<
  Array<{
    id: string;
    body: string;
    createdAt: Date;
    providerMessageId: string;
    source: "reminder" | "ai_reply";
  }>
> {
  const prisma = getPrisma();
  const prefix = reminderIdempotencyPrefix(input.workspaceId, input.appointmentId);

  const reminderRows = await prisma.message.findMany({
    where: {
      workspaceId: input.workspaceId,
      idempotencyKey: { startsWith: prefix },
    },
    orderBy: { createdAt: "asc" },
    take: MAX_LEDGER_ROWS,
    select: {
      id: true,
      body: true,
      createdAt: true,
      providerId: true,
      status: true,
      idempotencyKey: true,
    },
  });

  const rows: Array<{
    id: string;
    body: string;
    createdAt: Date;
    providerMessageId: string;
    source: "reminder" | "ai_reply";
  }> = [];

  for (const r of reminderRows) {
    if (!isProvenOutboundLedgerRow(r)) continue;
    rows.push({
      id: `ledger:${r.id}`,
      body: r.body.trim(),
      createdAt: r.createdAt,
      providerMessageId: r.providerId!.trim(),
      source: "reminder",
    });
  }

  if (input.replySessionId) {
    const replyKeyPrefix = `${AR_SMS_IDEMPOTENCY_PREFIX}reply:`;
    const replyRows = await prisma.message.findMany({
      where: {
        workspaceId: input.workspaceId,
        idempotencyKey: { startsWith: replyKeyPrefix },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        body: true,
        createdAt: true,
        providerId: true,
        status: true,
        idempotencyKey: true,
      },
    });
    for (const r of replyRows) {
      if (!r.idempotencyKey?.includes(input.replySessionId)) continue;
      if (!isProvenOutboundLedgerRow(r)) continue;
      if (rows.some((x) => x.providerMessageId === r.providerId!.trim())) continue;
      rows.push({
        id: `ledger:${r.id}`,
        body: r.body.trim(),
        createdAt: r.createdAt,
        providerMessageId: r.providerId!.trim(),
        source: "ai_reply",
      });
    }
  }

  rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return rows;
}

export function mergeArConversationThreadMessages(
  persisted: ArConversationThreadMessageHydrated[],
  ledger: Array<{
    id: string;
    body: string;
    createdAt: Date;
    providerMessageId: string;
  }>,
): ArConversationThreadMessageHydrated[] {
  const byProvider = new Set<string>();
  for (const m of persisted) {
    if (m.providerMessageId) byProvider.add(m.providerMessageId);
  }

  const merged = [...persisted];
  for (const row of ledger) {
    if (byProvider.has(row.providerMessageId)) continue;
    merged.push({
      id: row.id,
      direction: "outbound",
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      label: "Sent by Transovo",
      providerMessageId: row.providerMessageId,
    });
    byProvider.add(row.providerMessageId);
  }

  merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return merged;
}

/**
 * Persist any ledger-proven outbound rows missing from conversationMessage (repair gaps).
 */
export async function repairMissingArConversationOutboundFromLedger(input: {
  conversationId: string;
  workspaceId: string;
  appointmentId: string;
  replySessionId?: string | null;
}): Promise<number> {
  const prisma = getPrisma();
  const existing = await prisma.conversationMessage.findMany({
    where: { conversationId: input.conversationId },
    select: { providerMessageId: true },
  });
  const have = new Set(
    existing.map((e) => e.providerMessageId).filter((id): id is string => Boolean(id)),
  );

  const ledger = await loadProvenArAppointmentOutboundLedger({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    replySessionId: input.replySessionId,
  });

  let repaired = 0;
  for (const row of ledger) {
    if (have.has(row.providerMessageId)) continue;
    await appendArConversationOutboundMessage({
      conversationId: input.conversationId,
      body: row.body,
      providerMessageId: row.providerMessageId,
    });
    have.add(row.providerMessageId);
    repaired += 1;
  }
  return repaired;
}
