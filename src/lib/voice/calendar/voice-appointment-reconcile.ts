import { getPrisma } from "@/lib/db";
import type { BusyInterval } from "@/lib/voice/calendar/providers";

/** Default TTL when runtime creates an explicit hold without a custom expiry. */
export const VOICE_APPOINTMENT_DEFAULT_HOLD_MS = Number(
  process.env.VOICE_APPOINTMENT_DEFAULT_HOLD_MS || 15 * 60 * 1000,
);

export type VoiceAppointmentAvailabilityClass =
  | "PROVIDER_CONFIRMED"
  | "VALID_TEMP_HOLD"
  | "FAILED_PROVIDER_WRITE"
  | "STALE_UNCONFIRMED"
  | "ORPHANED_LOCAL_ROW"
  | "TIMEZONE_MISMATCH"
  | "NON_BLOCKING";

/** Metadata written by booking runtime when intentionally holding a slot during in-flight book. */
export const BOOKING_HOLD_FLAG = "booking_hold";
export const BOOKING_HOLD_EXPIRES_AT = "booking_hold_expires_at";
export const BOOKING_HOLD_REASON = "booking_hold_reason";

const ALLOWED_BOOKING_HOLD_REASONS = new Set([
  "voice_v2_book_in_progress",
  "mctb_book_in_progress",
  "voice_book_in_progress",
]);

export type VoiceAppointmentRowForReconcile = {
  id: string;
  workspaceId: string;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string | null;
  externalId: string | null;
  createdAt: Date;
  metadata: unknown;
};

export function voiceAppointmentMetadata(
  metadata: unknown,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

/**
 * Explicit temporary hold — age alone is never sufficient.
 * Requires runtime flag + future expiry + known hold reason.
 */
export function readExplicitBookingHold(
  meta: Record<string, unknown>,
  nowMs = Date.now(),
): { active: boolean; expiresAtMs: number | null } {
  if (meta[BOOKING_HOLD_FLAG] !== true && meta.availability_hold !== true) {
    return { active: false, expiresAtMs: null };
  }
  const reason = String(meta[BOOKING_HOLD_REASON] || "").trim();
  if (!ALLOWED_BOOKING_HOLD_REASONS.has(reason)) {
    return { active: false, expiresAtMs: null };
  }
  const expRaw = meta[BOOKING_HOLD_EXPIRES_AT] ?? meta.hold_expires_at;
  let expiresAtMs: number | null = null;
  if (typeof expRaw === "string") {
    expiresAtMs = Date.parse(expRaw);
  } else if (typeof expRaw === "number" && Number.isFinite(expRaw)) {
    expiresAtMs = expRaw;
  }
  if (expiresAtMs == null || !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { active: false, expiresAtMs };
  }
  return { active: true, expiresAtMs };
}

export function buildBookingHoldMetadata(input: {
  reason: "voice_v2_book_in_progress" | "mctb_book_in_progress" | "voice_book_in_progress";
  expiresAt: Date;
  offerSetId?: string;
  slotId?: string;
}): Record<string, unknown> {
  return {
    [BOOKING_HOLD_FLAG]: true,
    [BOOKING_HOLD_REASON]: input.reason,
    [BOOKING_HOLD_EXPIRES_AT]: input.expiresAt.toISOString(),
    ...(input.offerSetId ? { offer_set_id: input.offerSetId } : {}),
    ...(input.slotId ? { slot_id: input.slotId } : {}),
  };
}

/**
 * Whether this ledger row should block availability (FIND + BOOK revalidation).
 * Overlap decisions use startsAt/endsAt UTC instants only.
 */
export function classifyVoiceAppointmentForAvailability(
  row: VoiceAppointmentRowForReconcile,
  nowMs = Date.now(),
): VoiceAppointmentAvailabilityClass {
  const status = String(row.status || "").trim().toLowerCase();
  if (status === "cancelled" || status === "canceled") {
    return "NON_BLOCKING";
  }

  const meta = voiceAppointmentMetadata(row.metadata);
  const externalId = String(row.externalId || "").trim();
  const source = String(meta.source || "").trim().toLowerCase();
  const hasEnds = row.endsAt && Number.isFinite(row.endsAt.getTime());

  if (externalId) {
    return "PROVIDER_CONFIRMED";
  }

  if (status === "confirmed") {
    if (meta.voice_v2 === true) {
      return "FAILED_PROVIDER_WRITE";
    }
    if (source === "public_booking" || meta.cert === true) {
      return "ORPHANED_LOCAL_ROW";
    }
    return "ORPHANED_LOCAL_ROW";
  }

  if (status === "awaiting_confirmation") {
    const hold = readExplicitBookingHold(meta, nowMs);
    if (hold.active) {
      return "VALID_TEMP_HOLD";
    }
    if (source === "public_booking" || meta.cert === true) {
      return "ORPHANED_LOCAL_ROW";
    }
    return "STALE_UNCONFIRMED";
  }

  if (!hasEnds) {
    return "NON_BLOCKING";
  }

  return "NON_BLOCKING";
}

export function voiceAppointmentBlocksAvailability(
  classification: VoiceAppointmentAvailabilityClass,
): boolean {
  return (
    classification === "PROVIDER_CONFIRMED" || classification === "VALID_TEMP_HOLD"
  );
}

function rowToBusyInterval(
  row: VoiceAppointmentRowForReconcile,
  bufferMs: number,
): BusyInterval | null {
  if (!row.endsAt) return null;
  const startMs = row.startsAt.getTime();
  const endMs = row.endsAt.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return {
    start: new Date(startMs - bufferMs),
    end: new Date(endMs + bufferMs),
  };
}

/**
 * Canonical local busy intervals for availability (FIND + BOOK use the same classifier).
 */
export async function listReconciledVoiceAppointmentBusyIntervals(
  workspaceId: string,
  rangeStart: Date,
  rangeEnd: Date,
  bufferMinutes = 0,
): Promise<BusyInterval[]> {
  const bufferMs = Math.max(0, bufferMinutes) * 60_000;
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      status: { notIn: ["cancelled", "canceled"] },
      startsAt: { lte: new Date(rangeEnd.getTime() + bufferMs) },
      endsAt: { gte: new Date(rangeStart.getTime() - bufferMs) },
    },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      externalId: true,
      createdAt: true,
      metadata: true,
    },
  });

  const out: BusyInterval[] = [];
  for (const row of rows) {
    const classification = classifyVoiceAppointmentForAvailability(row);
    if (!voiceAppointmentBlocksAvailability(classification)) continue;
    const interval = rowToBusyInterval(row, bufferMs);
    if (interval) out.push(interval);
  }
  return out;
}

/** @deprecated Use listReconciledVoiceAppointmentBusyIntervals */
export const listAuthoritativeVoiceAppointmentBusyIntervals =
  listReconciledVoiceAppointmentBusyIntervals;

/**
 * Single merge used by Microsoft-backed FIND: provider busy + reconciled local ledger.
 */
export function mergeProviderBusyWithReconciledLedger(
  providerBusy: BusyInterval[],
  ledgerBusy: BusyInterval[],
): BusyInterval[] {
  if (!ledgerBusy.length) return providerBusy;
  if (!providerBusy.length) return ledgerBusy;
  return providerBusy.concat(ledgerBusy);
}

export async function findReconciledVoiceAppointmentConflict(
  workspaceId: string,
  startUtc: Date,
  endUtc: Date,
): Promise<{ id: string; classification: VoiceAppointmentAvailabilityClass } | null> {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      status: { notIn: ["cancelled", "canceled"] },
      startsAt: { lte: endUtc },
      endsAt: { gte: startUtc },
    },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      externalId: true,
      createdAt: true,
      metadata: true,
    },
  });

  for (const row of rows) {
    const classification = classifyVoiceAppointmentForAvailability(row);
    if (voiceAppointmentBlocksAvailability(classification)) {
      return { id: row.id, classification };
    }
  }
  return null;
}

/** @deprecated Use findReconciledVoiceAppointmentConflict */
export const findAuthoritativeVoiceAppointmentConflict =
  findReconciledVoiceAppointmentConflict;
