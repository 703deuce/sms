import "server-only";

import { randomBytes } from "crypto";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";

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
      id: `opt_${i}`,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      votes: 0,
    })),
    status: "open",
    createdAt: new Date().toISOString(),
  };
}
