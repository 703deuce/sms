import type { AiReschedulerConfig } from "@/lib/appointment-reminders/ai-rescheduler/types";

export function deriveAppointmentDurationMinutes(
  startsAt: Date,
  endsAt: Date,
  ar: Pick<AiReschedulerConfig, "durationMode" | "fixedDurationMinutes">,
): number | null {
  if (ar.durationMode === "fixed" && ar.fixedDurationMinutes) {
    return ar.fixedDurationMinutes;
  }
  const ms = endsAt.getTime() - startsAt.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(15, Math.round(ms / 60_000));
}
