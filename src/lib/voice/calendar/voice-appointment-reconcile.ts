import { getPrisma } from "@/lib/db";
import type { BusyInterval } from "@/lib/voice/calendar/providers";

/** How long an awaiting_confirmation row may block slots without a provider event id. */
export const VOICE_APPOINTMENT_AWAITING_HOLD_MS = Number(
  process.env.VOICE_APPOINTMENT_AWAITING_HOLD_MS || 30 * 60 * 1000,
);

export type VoiceAppointmentAvailabilityClass =
  | "PROVIDER_CONFIRMED"
  | "VALID_TEMP_HOLD"
  | "FAILED_PROVIDER_WRITE"
  | "STALE_UNCONFIRMED"
  | "ORPHANED_LOCAL_ROW"
  | "TIMEZONE_MISMATCH"
  | "NON_BLOCKING";

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
 * Whether this ledger row should block availability (FIND + BOOK revalidation).
 * Uses UTC instants on startsAt/endsAt — callers must not compare raw wall strings.
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
  const ageMs = nowMs - row.createdAt.getTime();
  const hasEnds = row.endsAt && Number.isFinite(row.endsAt.getTime());

  if (externalId) {
    if (status === "confirmed" || status === "scheduled") {
      return "PROVIDER_CONFIRMED";
    }
    // Provider id present but not confirmed — still treat as commitment until reconciled
    return "PROVIDER_CONFIRMED";
  }

  if (status === "confirmed") {
    // Legacy/local confirmed without Graph id — do not permanently poison availability
    if (meta.voice_v2 === true) {
      return "FAILED_PROVIDER_WRITE";
    }
    if (source === "public_booking") {
      return "ORPHANED_LOCAL_ROW";
    }
    return "ORPHANED_LOCAL_ROW";
  }

  if (status === "awaiting_confirmation") {
    if (ageMs <= VOICE_APPOINTMENT_AWAITING_HOLD_MS) {
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
 * Local ledger intervals that should merge with Microsoft Graph busy for availability.
 */
export async function listAuthoritativeVoiceAppointmentBusyIntervals(
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

export async function findAuthoritativeVoiceAppointmentConflict(
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
