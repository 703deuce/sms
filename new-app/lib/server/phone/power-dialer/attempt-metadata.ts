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
  amdFilter?: boolean;
  dialMode?: string;
  connectionPhase?: string;
  screeningPending?: boolean;
  screeningOutcome?: string;
  screeningDetectedAt?: string;
  screeningTimeoutScheduled?: boolean;
  screeningTimeoutAt?: string;
  telnyxAmdRaw?: string;
  telnyxScreeningRaw?: string;
  amdDetectionMode?: string;
  amdBillingTier?: string;
  iosScreeningRequested?: boolean;
  iosScreeningWireActive?: boolean;
  iosScreeningWireStatus?: string;
  iosPromptEndedAt?: string;
  screeningNotifyRep?: boolean;
  screeningAction?: string;
  screeningReason?: string;
  amdSessionStarted?: boolean;
  lastScreeningExecKey?: string;
  screeningActionFailed?: string;
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
