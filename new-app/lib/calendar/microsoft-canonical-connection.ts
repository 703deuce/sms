import "server-only";

import { createHash } from "node:crypto";
import { mergeCalendarConnectionConfig } from "@/lib/calendar/connection-config-merge";
import {
  createWorkspaceCalendarConnection,
  updateWorkspaceCalendarConnection,
} from "@/lib/calendar/connections";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/server/db";

export type MicrosoftAccountIdentity = {
  microsoftUserId?: string | null;
  tenantId?: string | null;
  email?: string | null;
};

type ConnectionRow = {
  id: string;
  status: string;
  createdAt: Date;
  config: unknown;
};

const CREATE_LOCK_NAMESPACE = 0x4d534343; // "MSCC"

async function withMicrosoftConnectionCreateLock<T>(
  workspaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const digest = createHash("sha256").update(workspaceId).digest();
  const k1 = CREATE_LOCK_NAMESPACE;
  const k2 = digest.readInt32BE(0) ^ digest.readInt32BE(4);
  const prisma = getPrisma();
  let locked = false;
  try {
    await prisma.$executeRaw`SELECT pg_advisory_lock(${k1}, ${k2})`;
    locked = true;
  } catch {
    // compat without advisory SQL
  }
  try {
    return await fn();
  } finally {
    if (locked) {
      try {
        await prisma.$executeRaw`SELECT pg_advisory_unlock(${k1}, ${k2})`;
      } catch {
        // ignore
      }
    }
  }
}

const ACTIVE_STATUSES = new Set([
  "connected",
  "needs_reauth",
  "pending_oauth",
  "pending",
  "active",
  "verified",
  "ok",
]);

function normalizeEmail(email: string | undefined | null): string | null {
  const v = email?.trim().toLowerCase();
  return v || null;
}

export function isSameMicrosoftAccount(
  a: MicrosoftAccountIdentity & CalendarConfig,
  b: MicrosoftAccountIdentity & CalendarConfig,
): boolean {
  const aUser = a.microsoftUserId?.trim();
  const bUser = b.microsoftUserId?.trim();
  if (aUser && bUser) return aUser === bUser;

  const aTenant = a.tenantId?.trim();
  const bTenant = b.tenantId?.trim();
  const aEmail = normalizeEmail(a.email);
  const bEmail = normalizeEmail(b.email);
  if (aEmail && bEmail && aEmail === bEmail) {
    if (aTenant && bTenant) return aTenant === bTenant;
    return true;
  }
  return false;
}

function importScore(config: CalendarConfig): number {
  const n = config.importCalendarIds?.length ?? 0;
  return n > 0 ? 1_000 + n : 0;
}

/** Prefer import-enabled row (stable external ids), then connected, then oldest. */
export function pickCanonicalMicrosoftConnection(rows: ConnectionRow[]): ConnectionRow | null {
  const active = rows.filter((r) => ACTIVE_STATUSES.has(String(r.status || "").toLowerCase()));
  const pool = active.length ? active : rows;
  if (!pool.length) return null;

  return [...pool].sort((a, b) => {
    const aCfg = (a.config || {}) as CalendarConfig;
    const bCfg = (b.config || {}) as CalendarConfig;
    const scoreDiff = importScore(bCfg) - importScore(aCfg);
    if (scoreDiff !== 0) return scoreDiff;
    const aConnected = a.status === "connected" ? 1 : 0;
    const bConnected = b.status === "connected" ? 1 : 0;
    if (bConnected !== aConnected) return bConnected - aConnected;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

export async function listMicrosoftConnectionsForWorkspace(workspaceId: string): Promise<ConnectionRow[]> {
  const prisma = getPrisma();
  return prisma.voiceCalendarConnection.findMany({
    where: { workspaceId, provider: "microsoft" },
    orderBy: { createdAt: "asc" },
    select: { id: true, status: true, createdAt: true, config: true },
  });
}

/**
 * Reuse an existing Microsoft row instead of creating duplicates (same workspace).
 * Distinct Microsoft accounts remain separate rows once OAuth provides identity.
 */
export async function resolveMicrosoftCalendarConnectionForCreate(
  workspaceId: string,
  input?: { name?: string; config?: Record<string, unknown> },
): Promise<{ connection: Awaited<ReturnType<typeof createWorkspaceCalendarConnection>>; created: boolean }> {
  const rows = await listMicrosoftConnectionsForWorkspace(workspaceId);
  const reusable = rows.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s !== "disconnected" && s !== "replaced";
  });
  const canonical = pickCanonicalMicrosoftConnection(reusable);
  if (canonical) {
    const existing = await getPrisma().voiceCalendarConnection.findUnique({ where: { id: canonical.id } });
    if (existing) return { connection: existing, created: false };
  }
  const connection = await createWorkspaceCalendarConnection(workspaceId, {
    name: input?.name,
    provider: "microsoft",
    config: input?.config,
  });
  return { connection, created: true };
}

export type MicrosoftCanonicalizeResult = {
  canonicalConnectionId: string;
  redirectedFromId?: string;
  disconnectedIds: string[];
};

/**
 * After OAuth, ensure tokens and import config live on one canonical row per Microsoft account.
 */
export async function canonicalizeMicrosoftConnectionAfterOAuth(input: {
  workspaceId: string;
  activeConnectionId: string;
  identity: MicrosoftAccountIdentity;
  oauthConfig: CalendarConfig;
}): Promise<MicrosoftCanonicalizeResult> {
  const rows = await listMicrosoftConnectionsForWorkspace(input.workspaceId);
  const identityCfg = {
    ...input.identity,
    ...input.oauthConfig,
  } as CalendarConfig & MicrosoftAccountIdentity;

  const sameAccountRows = rows.filter((r) => {
    const cfg = (r.config || {}) as CalendarConfig;
    return isSameMicrosoftAccount(identityCfg, { ...identityCfg, ...cfg });
  });

  const canonical = pickCanonicalMicrosoftConnection(
    sameAccountRows.length ? sameAccountRows : rows.filter((r) => r.id === input.activeConnectionId),
  );
  if (!canonical) {
    return { canonicalConnectionId: input.activeConnectionId, disconnectedIds: [] };
  }

  const disconnectedIds: string[] = [];
  const canonicalConfig = mergeCalendarConnectionConfig(
    (canonical.config || {}) as Record<string, unknown>,
    input.oauthConfig as Record<string, unknown>,
  ) as CalendarConfig;

  for (const row of sameAccountRows) {
    if (row.id === canonical.id) continue;
    const siblingCfg = (row.config || {}) as CalendarConfig;
    const importPatch = pickImportFields(siblingCfg);
    Object.assign(canonicalConfig, mergeCalendarConnectionConfig(canonicalConfig, importPatch));
    await updateWorkspaceCalendarConnection(input.workspaceId, row.id, {
      status: "disconnected",
      config: {
        replacedByConnectionId: canonical.id,
        replacedAt: new Date().toISOString(),
        replaceReason: "canonical_microsoft_account",
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      },
    });
    disconnectedIds.push(row.id);
  }

  await updateWorkspaceCalendarConnection(input.workspaceId, canonical.id, {
    status: "connected",
    config: canonicalConfig as Record<string, unknown>,
  });

  return {
    canonicalConnectionId: canonical.id,
    redirectedFromId: canonical.id !== input.activeConnectionId ? input.activeConnectionId : undefined,
    disconnectedIds,
  };
}

const IMPORT_FIELDS = [
  "importCalendarIds",
  "writeCalendarId",
  "syncEnabled",
  "phoneFieldKeys",
  "importTitleInclude",
  "importTitleExclude",
  "microsoftDeltaLinks",
  "microsoftSubscription",
] as const;

function pickImportFields(config: CalendarConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of IMPORT_FIELDS) {
    const value = config[key];
    if (value === undefined || value === null) continue;
    if (key === "importCalendarIds" && Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}
