import type { ExistingAppointmentCandidateSet } from "./appointment-management-types";

export function buildLiveManagementCandidatesAppend(
  candidateSet: ExistingAppointmentCandidateSet,
): { type: "session.thinking.append"; thinking: string } {
  const lines = candidateSet.candidates.map(
    (c, i) => `${i + 1}. ${c.appointment.localStart} (${c.candidateId})`,
  );
  return {
    type: "session.thinking.append",
    thinking: [
      "Multiple existing appointments match. Ask which one the caller means.",
      "Resolve ordinals against this authoritative list only:",
      ...lines,
    ].join("\n"),
  };
}

export function buildLiveRescheduleConfirmedAppend(input: {
  fromLocal: string;
  toLocal: string;
  timezone: string;
}): { type: "session.thinking.append"; thinking: string } {
  return {
    type: "session.thinking.append",
    thinking: [
      "Microsoft has confirmed the appointment was moved.",
      `From: ${input.fromLocal}`,
      `To: ${input.toLocal} (${input.timezone})`,
      "You may tell the caller it is rescheduled.",
    ].join("\n"),
  };
}

export function buildLiveCancellationConfirmedAppend(input: {
  localStart: string;
  timezone: string;
}): { type: "session.thinking.append"; thinking: string } {
  return {
    type: "session.thinking.append",
    thinking: [
      "Microsoft has confirmed the appointment is canceled.",
      `Canceled: ${input.localStart} (${input.timezone})`,
      "You may tell the caller it is canceled.",
    ].join("\n"),
  };
}
