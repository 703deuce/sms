/**
 * Customer-facing duplicate resolution — never silently create duplicates.
 * Decisions can be remembered per fingerprint.
 */

import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { getConnection, upsertConnection } from "@/lib/integrations/connections";
import { writeCrmAudit } from "./logging";
import { upsertObjectMapping } from "./mappings";
import type { CrmProviderId } from "./types";

export type ConflictDecision =
  | "use_crm"
  | "use_transovo"
  | "merge"
  | "ignore";

export type PendingConflict = {
  id: string;
  contactId: string;
  existingInternalId: string;
  externalId: string;
  fingerprint?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt: string;
  message: string;
};

type ConflictConfig = {
  pendingConflicts?: PendingConflict[];
  conflictDecisions?: Record<string, ConflictDecision>;
};

function cfgOf(conn: { configJson?: unknown } | null): ConflictConfig {
  return ((conn?.configJson || {}) as ConflictConfig) || {};
}

export async function listPendingConflicts(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<PendingConflict[]> {
  const conn = await getConnection(workspaceId, provider);
  return cfgOf(conn).pendingConflicts || [];
}

export async function getRememberedDecision(
  workspaceId: string,
  provider: CrmProviderId,
  fingerprint: string | null | undefined,
): Promise<ConflictDecision | null> {
  if (!fingerprint) return null;
  const conn = await getConnection(workspaceId, provider);
  return cfgOf(conn).conflictDecisions?.[fingerprint] || null;
}

export async function enqueuePendingConflict(input: {
  workspaceId: string;
  provider: CrmProviderId;
  contactId: string;
  existingInternalId: string;
  externalId: string;
  fingerprint?: string | null;
  phone?: string | null;
  email?: string | null;
  message: string;
}): Promise<PendingConflict> {
  const conn = await getConnection(input.workspaceId, input.provider);
  const cfg = cfgOf(conn);
  const pending = cfg.pendingConflicts || [];
  const existing = pending.find(
    (p) => p.contactId === input.contactId && p.externalId === input.externalId,
  );
  if (existing) return existing;

  const row: PendingConflict = {
    id: randomBytes(8).toString("hex"),
    contactId: input.contactId,
    existingInternalId: input.existingInternalId,
    externalId: input.externalId,
    fingerprint: input.fingerprint,
    phone: input.phone,
    email: input.email,
    createdAt: new Date().toISOString(),
    message: input.message,
  };
  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    config: { pendingConflicts: [...pending, row] },
    mergeConfig: true,
  });
  await writeCrmAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "conflict",
    action: "pending_duplicate",
    message: input.message,
    detail: {
      conflictId: row.id,
      contactId: input.contactId,
      externalId: input.externalId,
    },
  });
  return row;
}

export async function resolvePendingConflict(input: {
  workspaceId: string;
  provider: CrmProviderId;
  conflictId: string;
  decision: ConflictDecision;
  remember?: boolean;
  actorUserId?: string;
}) {
  const conn = await getConnection(input.workspaceId, input.provider);
  const cfg = cfgOf(conn);
  const pending = cfg.pendingConflicts || [];
  const row = pending.find((p) => p.id === input.conflictId);
  if (!row) throw new Error("Conflict not found");

  const decisions = { ...(cfg.conflictDecisions || {}) };
  if (input.remember && row.fingerprint) {
    decisions[row.fingerprint] = input.decision;
  }

  if (input.decision === "use_crm" || input.decision === "merge") {
    await upsertObjectMapping({
      workspaceId: input.workspaceId,
      provider: input.provider,
      objectType: "contact",
      internalId: row.contactId,
      externalId: row.externalId,
      fingerprint: row.fingerprint,
      metadata: { conflictDecision: input.decision, resolvedAt: new Date().toISOString() },
    });
  } else if (input.decision === "use_transovo") {
    // Leave unmapped so next push can create a new CRM record.
    await getPrisma().crmObjectMapping.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        objectType: "contact",
        internalId: row.contactId,
      },
    });
  }
  // ignore: drop pending only

  await upsertConnection({
    workspaceId: input.workspaceId,
    provider: input.provider,
    config: {
      pendingConflicts: pending.filter((p) => p.id !== input.conflictId),
      conflictDecisions: decisions,
    },
    mergeConfig: true,
  });

  await writeCrmAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "conflict",
    action: "resolved",
    message: `Duplicate resolved: ${input.decision}`,
    actorUserId: input.actorUserId,
    detail: { conflictId: input.conflictId, decision: input.decision, remember: input.remember },
  });

  return { ok: true, decision: input.decision };
}
