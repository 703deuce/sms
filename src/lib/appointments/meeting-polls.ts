import "server-only";

import { randomBytes } from "crypto";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";

type AppointmentTypeRow = {
  id: string;
  name: string;
  durationMinutes: number;
  config?: AppointmentTypeConfig;
};
import { assertEventTypeAccess } from "@/lib/appointments/org-permissions";
import { assertPollManageAccess } from "@/lib/appointments/meeting-poll-access";

export async function listMeetingPolls(workspaceId: string): Promise<MeetingPoll[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { meetingPolls?: MeetingPoll[] }).meetingPolls || [];
}

export async function getMeetingPoll(workspaceId: string, pollId: string): Promise<MeetingPoll | null> {
  const polls = await listMeetingPolls(workspaceId);
  return polls.find((p) => p.id === pollId) || null;
}

export async function saveMeetingPoll(workspaceId: string, poll: MeetingPoll) {
  const polls = await listMeetingPolls(workspaceId);
  const idx = polls.findIndex((p) => p.id === poll.id);
  const next = idx >= 0 ? polls.map((p, i) => (i === idx ? poll : p)) : [...polls, poll];
  await saveAppointmentPlatformConfig(workspaceId, { meetingPolls: next } as object);
  return poll;
}

export async function deleteMeetingPoll(workspaceId: string, pollId: string) {
  const polls = await listMeetingPolls(workspaceId);
  const next = polls.filter((p) => p.id !== pollId);
  await saveAppointmentPlatformConfig(workspaceId, { meetingPolls: next } as object);
}

export async function voteMeetingPollOption(
  workspaceId: string,
  pollId: string,
  optionId: string,
) {
  const polls = await listMeetingPolls(workspaceId);
  const poll = polls.find((p) => p.id === pollId);
  if (!poll || poll.status !== "open") return null;
  poll.options = poll.options.map((o) =>
    o.id === optionId ? { ...o, votes: o.votes + 1 } : o,
  );
  await saveMeetingPoll(workspaceId, poll);
  return poll;
}

export function createMeetingPoll(input: {
  workspaceId: string;
  title: string;
  appointmentTypeId?: string;
  options: Array<{ startsAt: string; endsAt: string }>;
}): MeetingPoll {
  return {
    id: `poll_${randomBytes(8).toString("hex")}`,
    workspaceId: input.workspaceId,
    title: input.title,
    appointmentTypeId: input.appointmentTypeId,
    options: input.options.map((o, i) => ({
      id: `opt_${i}_${randomBytes(4).toString("hex")}`,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      votes: 0,
    })),
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export async function finalizeMeetingPollBooking(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  pollId: string,
  winningOptionId: string,
) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) throw new Error("Poll not found");
  if (poll.status !== "open") throw new Error("Poll is not open for booking");

  await assertPollManageAccess(workspaceId, userId, email, poll);

  const option = poll.options.find((o) => o.id === winningOptionId);
  if (!option) throw new Error("Invalid winning time option");

  let serviceName = poll.title;
  let serviceId = poll.appointmentTypeId;
  let durationMinutes = Math.max(
    15,
    Math.round(
      (new Date(option.endsAt).getTime() - new Date(option.startsAt).getTime()) / 60000,
    ),
  );

  if (poll.appointmentTypeId) {
    const types = (await listAppointmentTypes(workspaceId)) as AppointmentTypeRow[];
    const type = types.find((t) => t.id === poll.appointmentTypeId);
    if (!type) throw new Error("Linked meeting type not found");
    serviceName = type.name;
    serviceId = type.id;
    durationMinutes = type.durationMinutes || durationMinutes;
  }

  const { createPlatformAppointment } = await import("@/lib/appointments/booking-platform");
  const result = await createPlatformAppointment(workspaceId, {
    serviceId,
    serviceName,
    startsAt: option.startsAt,
    durationMinutes,
    phone: "+15555550100",
    firstName: "Meeting",
    lastName: "Poll",
    notes: `Booked from meeting poll: ${poll.title}`,
    source: "admin",
    skipSms: true,
    status: "confirmed",
  });

  const appointmentId = String(result.appointmentId || "");
  if (!appointmentId) throw new Error("Failed to create appointment from poll");

  const updated: MeetingPoll = {
    ...poll,
    status: "booked",
    bookedAppointmentId: appointmentId,
  };
  await saveMeetingPoll(workspaceId, updated);
  return { poll: updated, appointmentId };
}

export async function closeMeetingPoll(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  pollId: string,
) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) throw new Error("Poll not found");
  await assertPollManageAccess(workspaceId, userId, email, poll);
  if (poll.status !== "open") throw new Error("Poll is already closed");
  const updated = { ...poll, status: "closed" as const };
  await saveMeetingPoll(workspaceId, updated);
  return updated;
}

export async function assertPollCreateAccess(
  workspaceId: string,
  userId: string,
  email: string | undefined,
  appointmentTypeId?: string,
): Promise<void> {
  if (!appointmentTypeId) throw new Error("Meeting type is required");
  const types = (await listAppointmentTypes(workspaceId)) as AppointmentTypeRow[];
  const type = types.find((t) => t.id === appointmentTypeId);
  if (!type) throw new Error("Meeting type not found");
  if (type.config?.bookingTypeKind !== "MEETING") {
    throw new Error("Polls can only use Meeting booking types");
  }
  await assertEventTypeAccess(workspaceId, userId, email, type.config || {}, "book");
}
