import { getPrisma } from "@/lib/server/db";
import { readAttemptMetadata } from "./attempt-metadata";
import { pickBridgeWinner } from "./parallel-orchestrator";

export type WinnerClaimResult =
  | { outcome: "won"; winnerAttemptId: string }
  | { outcome: "lost"; winnerAttemptId: string }
  | { outcome: "ineligible"; reason: string };

/**
 * Atomically commit at most one parallel winner per session (Postgres JSON conditional update).
 */
export async function tryAtomicParallelWinnerClaim(input: {
  workspaceId: string;
  sessionId: string;
  attemptId: string;
  answeredAtMs: number;
}): Promise<WinnerClaimResult> {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId, sessionId: input.sessionId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) return { outcome: "ineligible", reason: "not_found" };

  const meta = readAttemptMetadata(attempt.metadataJson);
  if (meta.parallelLoser) return { outcome: "ineligible", reason: "parallel_loser" };
  if (meta.screeningPending) return { outcome: "ineligible", reason: "screening_pending" };
  if (attempt.answerClassification === "screener") {
    return { outcome: "ineligible", reason: "screener_not_human" };
  }

  const session = attempt.session;
  const parallelState =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};
  const pending = Array.isArray(parallelState.pendingAnswers)
    ? (parallelState.pendingAnswers as { attemptId: string; answeredAtMs: number }[])
    : [];
  const nextPending = [...pending, { attemptId: input.attemptId, answeredAtMs: input.answeredAtMs }];
  const winnerId = pickBridgeWinner(nextPending);
  if (!winnerId) return { outcome: "ineligible", reason: "no_winner" };

  if (winnerId !== input.attemptId) {
    return { outcome: "lost", winnerAttemptId: winnerId };
  }

  const committedAt = new Date().toISOString();
  const rows = await prisma.$executeRaw`
    UPDATE "power_dialer_sessions"
    SET "parallelStateJson" = COALESCE("parallelStateJson", '{}'::jsonb)
      || jsonb_build_object(
        'winnerAttemptId', ${input.attemptId}::text,
        'winnerCommittedAt', ${committedAt}::text,
        'pendingAnswers', ${JSON.stringify(nextPending)}::jsonb
      )
    WHERE "id" = ${input.sessionId}
      AND "workspaceId" = ${input.workspaceId}
      AND (
        "parallelStateJson" IS NULL
        OR "parallelStateJson"->>'winnerAttemptId' IS NULL
        OR "parallelStateJson"->>'winnerAttemptId' = ${input.attemptId}
      )
  `;

  if (rows === 0) {
    const refreshed = await prisma.powerDialerSession.findFirst({
      where: { id: input.sessionId, workspaceId: input.workspaceId },
      select: { parallelStateJson: true },
    });
    const state =
      refreshed?.parallelStateJson && typeof refreshed.parallelStateJson === "object"
        ? (refreshed.parallelStateJson as Record<string, unknown>)
        : {};
    const existing =
      typeof state.winnerAttemptId === "string" ? state.winnerAttemptId : null;
    if (existing === input.attemptId) {
      return { outcome: "won", winnerAttemptId: input.attemptId };
    }
    if (existing) return { outcome: "lost", winnerAttemptId: existing };
    return { outcome: "ineligible", reason: "claim_race" };
  }

  return { outcome: "won", winnerAttemptId: input.attemptId };
}
