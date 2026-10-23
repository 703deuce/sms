import type { Prisma } from "@prisma/client";

export type AttemptMetadata = {
  abandonedCall?: boolean;
  parallelLoser?: boolean;
  parallelRoundId?: string;
  bridgeWinner?: boolean;
  answerToBridgeMs?: number;
  abandonmentReason?: string;
  amdClassification?: string;
  safeHarborPlayed?: boolean;
};

export function readAttemptMetadata(raw: Prisma.JsonValue | null | undefined): AttemptMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as AttemptMetadata;
}

export function mergeAttemptMetadata(
  existing: Prisma.JsonValue | null | undefined,
  patch: AttemptMetadata,
): Prisma.InputJsonValue {
  const prior = readAttemptMetadata(existing);
  return { ...prior, ...patch } as Prisma.InputJsonValue;
}
