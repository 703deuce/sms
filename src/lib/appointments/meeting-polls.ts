import "server-only";

import { randomBytes } from "crypto";
import { getPrisma } from "@/lib/db";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";

export function meetingPollShareUrl(baseUrl: string, pollId: string) {
  return `${baseUrl.replace(/\/$/, "")}/poll/${pollId}`;
}

export async function listMeetingPolls(workspaceId: string): Promise<MeetingPoll[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  return (platform as { meetingPolls?: MeetingPoll[] }).meetingPolls || [];
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
  const id = `poll_${randomBytes(8).toString("hex")}`;
  return {
    id,
    workspaceId: input.workspaceId,
    title: input.title,
    appointmentTypeId: input.appointmentTypeId,
    options: input.options.map((o, i) => ({
      id: `opt_${i}`,
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
  pollId: string,
  optionId: string,
  input?: {
    contactId?: string;
    phone?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  },
) {
  const polls = await listMeetingPolls(workspaceId);
  const poll = polls.find((p) => p.id === pollId);
  if (!poll) throw new Error("Poll not found");

  if (poll.status === "booked" && poll.bookedAppointmentId) {
    return { poll, appointmentId: poll.bookedAppointmentId, created: false };
  }

  if (poll.status !== "open") {
    throw new Error("This poll is no longer open for booking");
  }

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) throw new Error("Selected time is not part of this poll");

  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(workspaceId);

  let serviceName = poll.title;
  let serviceId = poll.appointmentTypeId;
  let durationMinutes =
    Math.max(1, Math.round((new Date(option.endsAt).getTime() - new Date(option.startsAt).getTime()) / 60_000)) ||
    30;

  if (poll.appointmentTypeId) {
    const svc = await prisma.voiceService.findFirst({
      where: { id: poll.appointmentTypeId, workspaceId },
    });
    if (svc) {
      serviceName = svc.name;
      serviceId = svc.id;
      durationMinutes = svc.durationMinutes || durationMinutes;
    }
  }

  let phone = input?.phone?.trim() || platform.businessPhone?.trim() || "";
  let email = input?.email?.trim();
  let firstName = input?.firstName?.trim() || "Meeting";
  let lastName = input?.lastName?.trim() || "Poll";
  let contactId = input?.contactId;

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { phone: true, email: true, firstName: true, lastName: true },
    });
    if (!contact) throw new Error("Contact not found");
    phone = contact.phone || phone;
    email = contact.email || email;
    firstName = contact.firstName || firstName;
    lastName = contact.lastName || lastName;
  }

  if (!phone) {
    throw new Error("A customer phone number is required to book this meeting");
  }

  const { createPlatformAppointment } = await import("@/lib/appointments/booking-platform");
  const result = await createPlatformAppointment(workspaceId, {
    serviceId,
    serviceName,
    startsAt: option.startsAt,
    durationMinutes,
    phone,
    email,
    firstName,
    lastName,
    contactId,
    source: "admin",
    skipSms: true,
    notes: `Booked from meeting poll ${pollId}`,
  });

  const appointmentId = String(result.appointmentId || "");
  if (!appointmentId) throw new Error("That time is no longer available");

  const bookedPoll: MeetingPoll = {
    ...poll,
    status: "booked",
    winningOptionId: optionId,
    bookedAppointmentId: appointmentId,
  };
  await saveMeetingPoll(workspaceId, bookedPoll);

  return { poll: bookedPoll, appointmentId, created: true };
}
