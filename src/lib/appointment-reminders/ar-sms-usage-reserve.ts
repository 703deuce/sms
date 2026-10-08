import "server-only";

import { getPrisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  USAGE_PERIOD_KEY,
  USAGE_REVISION_KEY,
  USAGE_USED,
} from "@/lib/appointment-reminders/ar-sms-usage-constants";
import { readArSmsUsedFromLimits } from "@/lib/appointment-reminders/ar-sms-usage-limit-math";

export { readArSmsUsedFromLimits } from "@/lib/appointment-reminders/ar-sms-usage-limit-math";

const MAX_CAS_ATTEMPTS = 16;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type ArSmsUsageCasIncrementResult =
  | { ok: true; used: number; limits: Record<string, unknown> }
  | { ok: false; reason: "at_limit"; used: number }
  | { ok: false; reason: "cas_exhausted"; used: number };

/**
 * Atomically increment metered usage when below limit using JSON revision CAS
 * (works on Supabase PostgREST — no advisory locks or raw SQL).
 */
export async function casIncrementArSmsUsageIfBelowLimit(input: {
  workspaceId: string;
  periodKey: string;
  limit: number;
}): Promise<ArSmsUsageCasIncrementResult> {
  const prisma = getPrisma();

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });

    const limits = asRecord(limitsRow?.limits);
    const revision = Number(limits[USAGE_REVISION_KEY] || 0);
    const used = readArSmsUsedFromLimits(limits, input.periodKey);

    if (used >= input.limit) {
      return { ok: false, reason: "at_limit", used };
    }

    const nextUsed = used + 1;
    const nextLimits = {
      ...limits,
      [USAGE_PERIOD_KEY]: input.periodKey,
      [USAGE_USED]: nextUsed,
      [USAGE_REVISION_KEY]: revision + 1,
    };

    if (!limitsRow) {
      try {
        await prisma.workspaceLimits.create({
          data: { workspaceId: input.workspaceId, limits: nextLimits },
        });
        return { ok: true, used: nextUsed, limits: nextLimits };
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === "P2002") continue;
        throw err;
      }
    }

    const updated = await prisma.workspaceLimits.updateMany({
      where: {
        workspaceId: input.workspaceId,
        limits: {
          path: [USAGE_REVISION_KEY],
          equals: revision,
        },
      },
      data: { limits: nextLimits as Prisma.InputJsonValue },
    });

    if (updated.count === 1) {
      return { ok: true, used: nextUsed, limits: nextLimits };
    }

    // First write on row that predates revision field: match null revision.
    if (revision === 0 && limits[USAGE_REVISION_KEY] === undefined) {
      const legacy = await prisma.workspaceLimits.updateMany({
        where: {
          workspaceId: input.workspaceId,
          limits: {
            path: [USAGE_REVISION_KEY],
            equals: null,
          },
        },
        data: { limits: nextLimits as Prisma.InputJsonValue },
      });
      if (legacy.count === 1) {
        return { ok: true, used: nextUsed, limits: nextLimits };
      }
    }
  }

  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { limits: true },
  });
  const used = readArSmsUsedFromLimits(asRecord(limitsRow?.limits), input.periodKey);
  return { ok: false, reason: "cas_exhausted", used };
}

export async function casDecrementArSmsUsage(input: {
  workspaceId: string;
  periodKey: string;
}): Promise<void> {
  const prisma = getPrisma();

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const limitsRow = await prisma.workspaceLimits.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { limits: true },
    });
    if (!limitsRow) return;

    const limits = asRecord(limitsRow.limits);
    if (String(limits[USAGE_PERIOD_KEY] || "") !== input.periodKey) return;

    const revision = Number(limits[USAGE_REVISION_KEY] || 0);
    const used = Math.max(0, Number(limits[USAGE_USED] || 0) - 1);
    const nextLimits = {
      ...limits,
      [USAGE_USED]: used,
      [USAGE_REVISION_KEY]: revision + 1,
    };

    const updated = await prisma.workspaceLimits.updateMany({
      where: {
        workspaceId: input.workspaceId,
        limits: {
          path: [USAGE_REVISION_KEY],
          equals: revision,
        },
      },
      data: { limits: nextLimits as Prisma.InputJsonValue },
    });
    if (updated.count === 1) return;

    if (revision === 0 && limits[USAGE_REVISION_KEY] === undefined) {
      const legacy = await prisma.workspaceLimits.updateMany({
        where: {
          workspaceId: input.workspaceId,
          limits: {
            path: [USAGE_REVISION_KEY],
            equals: null,
          },
        },
        data: { limits: nextLimits as Prisma.InputJsonValue },
      });
      if (legacy.count === 1) return;
    }
  }
}
