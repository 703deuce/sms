import type { WorkflowRelativeTiming, WorkflowStepTiming } from "./types";

const UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export function resolveStepScheduledTime(input: {
  timing: WorkflowStepTiming;
  appointmentStartsAt: Date;
  appointmentEndsAt?: Date | null;
  bookingCreatedAt: Date;
  now?: Date;
}): Date | null {
  const now = input.now || new Date();

  if (input.timing.kind === "immediate") {
    return now;
  }

  const { anchor, amount, unit, direction } = input.timing;
  const offsetMs = amount * (UNIT_MS[unit] || UNIT_MS.hours);
  const signedOffset = direction === "before" ? -offsetMs : offsetMs;

  let anchorTime: Date;
  switch (anchor) {
    case "appointment_end":
      anchorTime = input.appointmentEndsAt || input.appointmentStartsAt;
      break;
    case "booking_created":
      anchorTime = input.bookingCreatedAt;
      break;
    case "appointment_start":
    default:
      anchorTime = input.appointmentStartsAt;
      break;
  }

  const scheduled = new Date(anchorTime.getTime() + signedOffset);

  // Do not schedule "before appointment" steps after the appointment has started
  if (
    anchor === "appointment_start" &&
    direction === "before" &&
    scheduled.getTime() < now.getTime() &&
    input.appointmentStartsAt.getTime() <= now.getTime()
  ) {
    return null;
  }

  return scheduled;
}

export function stepIdempotencyKey(
  executionId: string,
  stepId: string,
  scheduledFor: Date,
  generation = 1,
): string {
  const bucket = Math.floor(scheduledFor.getTime() / 60_000);
  return `appt-wf:${executionId}:${stepId}:${generation}:${bucket}`;
}
