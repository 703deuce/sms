import { createId } from "@/lib/supabase/id";
import type { BookingAttemptSnapshot, BookingCommitPhase, ConfirmedBooking } from "./booking-types";

type RegistryRow = {
  attempt: BookingAttemptSnapshot;
  confirmed: ConfirmedBooking | null;
};

const bySession = new Map<string, Map<string, RegistryRow>>();

function sessionMap(liveSessionId: string): Map<string, RegistryRow> {
  let m = bySession.get(liveSessionId);
  if (!m) {
    m = new Map();
    bySession.set(liveSessionId, m);
  }
  return m;
}

export function bookingSlotKey(input: {
  schedulingGeneration: number;
  offerSetId: string;
  slotId: string;
}): string {
  return `${input.schedulingGeneration}|${input.offerSetId}|${input.slotId}`;
}

export function getOrCreateBookingAttempt(input: {
  liveSessionId: string;
  schedulingGeneration: number;
  offerSetId: string;
  slotId: string;
  now?: string;
}): BookingAttemptSnapshot {
  const key = bookingSlotKey(input);
  const map = sessionMap(input.liveSessionId);
  const existing = map.get(key);
  if (existing) {
    return existing.attempt;
  }

  const now = input.now ?? new Date().toISOString();
  const attempt: BookingAttemptSnapshot = {
    bookingAttemptId: `bka_${createId()}`,
    schedulingGeneration: input.schedulingGeneration,
    offerSetId: input.offerSetId,
    slotId: input.slotId,
    commitPhase: "PREPARING",
    createdAt: now,
    updatedAt: now,
  };
  map.set(key, { attempt, confirmed: null });
  return attempt;
}

export function updateBookingAttemptPhase(
  liveSessionId: string,
  bookingAttemptId: string,
  commitPhase: BookingCommitPhase,
): void {
  const map = sessionMap(liveSessionId);
  for (const row of map.values()) {
    if (row.attempt.bookingAttemptId === bookingAttemptId) {
      row.attempt = {
        ...row.attempt,
        commitPhase,
        updatedAt: new Date().toISOString(),
      };
      return;
    }
  }
}

export function getConfirmedBookingForSlot(
  liveSessionId: string,
  slotKey: string,
): ConfirmedBooking | null {
  return sessionMap(liveSessionId).get(slotKey)?.confirmed ?? null;
}

export function markBookingConfirmed(
  liveSessionId: string,
  slotKey: string,
  confirmed: ConfirmedBooking,
): void {
  const map = sessionMap(liveSessionId);
  const row = map.get(slotKey);
  if (row) {
    row.confirmed = confirmed;
    row.attempt = { ...row.attempt, commitPhase: "CONFIRMED", updatedAt: new Date().toISOString() };
  }
}

export function findInFlightCommit(liveSessionId: string): BookingAttemptSnapshot | null {
  for (const row of sessionMap(liveSessionId).values()) {
    if (
      row.attempt.commitPhase === "COMMIT_SENT" ||
      row.attempt.commitPhase === "REVALIDATING" ||
      row.attempt.commitPhase === "READY_TO_COMMIT"
    ) {
      return row.attempt;
    }
  }
  return null;
}

/** Test-only */
export function clearBookingAttemptRegistry(): void {
  bySession.clear();
}
