/**
 * Predictive pacing — how many lines to originate given rep availability and answer rate.
 * Pure functions for unit tests (no Telnyx).
 */

export type PredictivePacingInput = {
  repsAvailable: number;
  repsOnCall: number;
  historicalAnswerRate: number;
  targetAbandonRatePct: number;
  maxLinesPerRep: number;
  aggression: number;
  currentAbandonRatePct: number;
  hardStopAbandonPct: number;
};

export type PredictivePacingResult = {
  linesToDial: number;
  throttled: boolean;
  hardStop: boolean;
  reason: string;
};

export function computePredictiveLines(input: PredictivePacingInput): PredictivePacingResult {
  const {
    repsAvailable,
    repsOnCall,
    historicalAnswerRate,
    targetAbandonRatePct,
    maxLinesPerRep,
    aggression,
    currentAbandonRatePct,
    hardStopAbandonPct,
  } = input;

  if (currentAbandonRatePct >= hardStopAbandonPct) {
    return {
      linesToDial: 0,
      throttled: true,
      hardStop: true,
      reason: "abandon_rate_hard_stop",
    };
  }

  const answerRate = Math.min(0.95, Math.max(0.02, historicalAnswerRate));
  const abandonHeadroom = Math.max(0, targetAbandonRatePct - currentAbandonRatePct);
  let throttleFactor = 1;
  if (currentAbandonRatePct > targetAbandonRatePct) {
    throttleFactor = Math.max(0.25, abandonHeadroom / targetAbandonRatePct);
  }

  const freeReps = Math.max(0, repsAvailable - repsOnCall);
  if (freeReps <= 0) {
    return { linesToDial: 0, throttled: true, hardStop: false, reason: "no_free_reps" };
  }

  const raw =
    (freeReps / answerRate) * aggression * throttleFactor * (1 + targetAbandonRatePct / 100);
  const capped = Math.min(maxLinesPerRep * freeReps, Math.max(1, Math.floor(raw)));
  const linesToDial = Math.min(capped, maxLinesPerRep * Math.max(1, freeReps + repsOnCall));

  return {
    linesToDial,
    throttled: throttleFactor < 1,
    hardStop: false,
    reason: throttleFactor < 1 ? "abandon_auto_throttle" : "ok",
  };
}
