import 'server-only'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'

export const MOTION_HOURLY_LIMITS = {
  generate: 30,
  revise: 60,
  analyze_reference: 12,
} as const
export type MotionRequestKind = keyof typeof MOTION_HOURLY_LIMITS
const HOUR_MS = 3_600_000

export function motionBudgetWindow(nowMs: number) {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new Error('invalid_budget_clock')
  const startMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS
  return { start: new Date(startMs), retryAfterSec: Math.max(1, Math.ceil((startMs + HOUR_MS - nowMs) / 1000)) }
}

export type MotionBudgetDecision =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number }

/**
 * Reserve a paid-model operation *before* calling an external model.
 * A single DB UPSERT provides a durable multi-instance quota, even when two
 * browser tabs fire simultaneously. Refuse on DB error: do not fail open.
 */
export async function reserveMotionRequest(
  workspaceId: string,
  kind: MotionRequestKind,
  nowMs: number = Date.now(),
): Promise<MotionBudgetDecision> {
  if (!workspaceId) throw new Error('motion_budget_missing_workspace')
  const limit = MOTION_HOURLY_LIMITS[kind]
  const { start, retryAfterSec } = motionBudgetWindow(nowMs)
  const rows = await getPrisma().$queryRaw<Array<{ used: number }>>(Prisma.sql`
    INSERT INTO "motion_request_limits" ("workspaceId","kind","windowStart","used")
    VALUES (${workspaceId}, ${kind}, ${start}, 1)
    ON CONFLICT ("workspaceId","kind","windowStart")
    DO UPDATE SET "used" = "motion_request_limits"."used" + 1
    WHERE "motion_request_limits"."used" < ${limit}
    RETURNING "used"
  `)
  if (!rows.length) return { ok: false, retryAfterSec }
  return { ok: true, remaining: Math.max(0, limit - rows[0]!.used) }
}
