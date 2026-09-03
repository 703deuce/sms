/**
 * AI Booking Protection — layered risk scoring for public appointment bookings.
 */
import "server-only";

import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import {
  classifyBookingHeuristics,
  resolveBookingProtectionAction,
  type BookingProtectionMode,
  type BookingRiskEvaluation,
  type BookingRiskLevel,
} from "@/lib/appointments/booking-protection-policy";

export type { BookingProtectionMode, BookingRiskLevel, BookingRiskEvaluation };

export type SuspiciousBookingRecord = {
  id: string;
  at: string;
  serviceName?: string;
  phone?: string;
  email?: string;
  riskLevel: BookingRiskLevel;
  riskScore: number;
  signals: string[];
  action: "challenge" | "block";
  recovered?: boolean;
};

const recentAttempts = new Map<string, number[]>();

function rateKey(workspaceId: string, ip: string) {
  return `${workspaceId}:${ip || "unknown"}`;
}

function pruneOld(timestamps: number[], windowMs: number) {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t >= cutoff);
}

function countRecent(workspaceId: string, ip: string, windowMs: number): number {
  const key = rateKey(workspaceId, ip);
  const list = pruneOld(recentAttempts.get(key) || [], windowMs);
  recentAttempts.set(key, list);
  return list.length;
}

function recordAttempt(workspaceId: string, ip: string) {
  const key = rateKey(workspaceId, ip);
  const list = pruneOld(recentAttempts.get(key) || [], 15 * 60_000);
  list.push(Date.now());
  recentAttempts.set(key, list);
}

export async function evaluatePublicBookingRisk(input: {
  workspaceId: string;
  ip?: string;
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  notes?: string;
  bookingAnswers?: Record<string, string>;
  honeypot?: string;
  formStartedAt?: number;
  serviceName?: string;
  humanVerification?: boolean;
}): Promise<BookingRiskEvaluation> {
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const mode = platform.bookingProtection?.mode || "standard";
  const ip = input.ip || "unknown";

  recordAttempt(input.workspaceId, ip);
  const ipAttempts = countRecent(input.workspaceId, ip, 15 * 60_000);

  const prisma = getPrisma();
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  const recentPhoneBookings = await prisma.voiceAppointment.count({
    where: {
      workspaceId: input.workspaceId,
      createdAt: { gte: since },
      metadata: { path: ["inviteePhone"], equals: input.phone },
    },
  });

  const base = classifyBookingHeuristics({
    phone: input.phone,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    notes: input.notes,
    bookingAnswers: input.bookingAnswers,
    honeypot: input.honeypot,
    formStartedAt: input.formStartedAt,
    ipAttempts,
    recentPhoneBookings,
  });

  return resolveBookingProtectionAction(base, mode, input.humanVerification);
}

export async function recordSuspiciousBooking(
  workspaceId: string,
  record: Omit<SuspiciousBookingRecord, "id" | "at">,
) {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const existing = platform.suspiciousBookings || [];
  const entry: SuspiciousBookingRecord = {
    id: `sb_${Date.now()}`,
    at: new Date().toISOString(),
    ...record,
  };
  await saveAppointmentPlatformConfig(workspaceId, {
    suspiciousBookings: [entry, ...existing].slice(0, 100),
  });
  return entry;
}

export function resetBookingProtectionRateLimiterForTests() {
  recentAttempts.clear();
}
