import "server-only";

import { randomBytes } from "crypto";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { MeetingPoll, MeetingPollVoteValue } from "@/lib/appointments/scheduling-capabilities";
import {
  appendPollActivity,
  createParticipant,
  DEFAULT_POLL_SETTINGS,
  derivePollStatus,
  normalizeMeetingPoll,
  touchPoll,
} from "@/lib/appointments/meeting-polls/model";

function newId(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export async function listMeetingPolls(workspaceId: string): Promise<MeetingPoll[]> {
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const raw = (platform as { meetingPolls?: MeetingPoll[] }).meetingPolls || [];
  return raw.map(normalizeMeetingPoll).map((p) => ({ ...p, status: derivePollStatus(p) }));
}

export async function getMeetingPoll(workspaceId: string, pollId: string): Promise<MeetingPoll | null> {
  const polls = await listMeetingPolls(workspaceId);
  return polls.find((p) => p.id === pollId) || null;
}

export async function getMeetingPollByShareToken(workspaceId: string, shareToken: string): Promise<MeetingPoll | null> {
  const polls = await listMeetingPolls(workspaceId);
  return polls.find((p) => p.shareToken === shareToken) || null;
}

export async function getMeetingPollByParticipantToken(
  workspaceId: string,
  inviteToken: string,
): Promise<MeetingPoll | null> {
  const polls = await listMeetingPolls(workspaceId);
  return polls.find((p) => p.participants.some((part) => part.inviteToken === inviteToken)) || null;
}

export async function saveMeetingPoll(workspaceId: string, poll: MeetingPoll) {
  const polls = await listMeetingPolls(workspaceId);
  const normalized = normalizeMeetingPoll({ ...poll, status: derivePollStatus(poll) });
  const idx = polls.findIndex((p) => p.id === normalized.id);
  const next = idx >= 0 ? polls.map((p, i) => (i === idx ? normalized : p)) : [...polls, normalized];
  await saveAppointmentPlatformConfig(workspaceId, { meetingPolls: next } as object);
  return normalized;
}

export async function deleteMeetingPoll(workspaceId: string, pollId: string) {
  const polls = await listMeetingPolls(workspaceId);
  const poll = polls.find((p) => p.id === pollId);
  if (!poll) return;
  if (poll.bookedAppointmentId || poll.responses.length > 0) {
    throw new Error("Poll with responses or a finalized meeting cannot be deleted. Cancel instead.");
  }
  const next = polls.filter((p) => p.id !== pollId);
  await saveAppointmentPlatformConfig(workspaceId, { meetingPolls: next } as object);
}

/** @deprecated Simple vote counter — use participant responses instead */
export async function voteMeetingPollOption(workspaceId: string, pollId: string, optionId: string) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll || poll.status !== "open") return null;
  poll.options = poll.options.map((o) =>
    o.id === optionId ? { ...o, votes: (o.votes || 0) + 1 } : o,
  );
  return saveMeetingPoll(workspaceId, poll);
}

export function createMeetingPoll(input: {
  workspaceId: string;
  title: string;
  description?: string;
  appointmentTypeId?: string;
  timezone?: string;
  durationMinutes?: number;
  meetingMethod?: MeetingPoll["meetingMethod"];
  location?: string;
  deadlineAt?: string;
  organizerStaffId?: string;
  organizerUserId?: string;
  options: Array<{ startsAt: string; endsAt: string }>;
  participants?: Array<{ name: string; email: string; contactId?: string }>;
  settings?: Partial<MeetingPoll["settings"]>;
  openImmediately?: boolean;
}): MeetingPoll {
  const now = new Date().toISOString();
  const participants = (input.participants || []).map((p) => createParticipant(p));
  return normalizeMeetingPoll({
    id: newId("poll"),
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    description: input.description?.trim(),
    appointmentTypeId: input.appointmentTypeId,
    timezone: input.timezone || "America/New_York",
    durationMinutes: input.durationMinutes || 30,
    meetingMethod: input.meetingMethod,
    location: input.location,
    options: input.options.map((o, i) => ({
      id: newId("opt"),
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      votes: 0,
    })),
    participants,
    responses: [],
    settings: { ...DEFAULT_POLL_SETTINGS, ...(input.settings || {}) },
    activity: [
      {
        id: newId("act"),
        at: now,
        actor: "Organizer",
        action: "Created poll",
      },
    ],
    status: input.openImmediately === false ? "draft" : "open",
    shareToken: randomBytes(16).toString("base64url"),
    deadlineAt: input.deadlineAt,
    organizerStaffId: input.organizerStaffId,
    organizerUserId: input.organizerUserId,
    createdAt: now,
    updatedAt: now,
  });
}

export async function duplicateMeetingPoll(workspaceId: string, pollId: string): Promise<MeetingPoll | null> {
  const source = await getMeetingPoll(workspaceId, pollId);
  if (!source) return null;
  const copy = createMeetingPoll({
    workspaceId,
    title: `Copy of ${source.title}`,
    description: source.description,
    appointmentTypeId: source.appointmentTypeId,
    timezone: source.timezone,
    durationMinutes: source.durationMinutes,
    meetingMethod: source.meetingMethod,
    location: source.location,
    deadlineAt: source.deadlineAt,
    organizerStaffId: source.organizerStaffId,
    organizerUserId: source.organizerUserId,
    options: source.options.filter((o) => !o.archivedAt).map((o) => ({
      startsAt: o.startsAt,
      endsAt: o.endsAt,
    })),
    participants: source.participants
      .filter((p) => p.status !== "removed")
      .map((p) => ({ name: p.name, email: p.email, contactId: p.contactId })),
    settings: source.settings,
    openImmediately: false,
  });
  return saveMeetingPoll(workspaceId, copy);
}

export async function closeMeetingPoll(workspaceId: string, pollId: string) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  let next = touchPoll({ ...poll, status: "closed" });
  next = appendPollActivity(next, { actor: "Organizer", action: "Poll closed" });
  return saveMeetingPoll(workspaceId, next);
}

export async function cancelMeetingPoll(workspaceId: string, pollId: string) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  let next = touchPoll({ ...poll, status: "cancelled" });
  next = appendPollActivity(next, { actor: "Organizer", action: "Poll cancelled" });
  return saveMeetingPoll(workspaceId, next);
}

export async function openMeetingPoll(workspaceId: string, pollId: string) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  let next = touchPoll({ ...poll, status: "open" });
  next = appendPollActivity(next, { actor: "Organizer", action: "Poll opened" });
  return saveMeetingPoll(workspaceId, next);
}

export async function addPollOption(
  workspaceId: string,
  pollId: string,
  option: { startsAt: string; endsAt: string },
) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  let next = touchPoll({
    ...poll,
    options: [...poll.options, { id: newId("opt"), startsAt: option.startsAt, endsAt: option.endsAt }],
  });
  next = appendPollActivity(next, {
    actor: "Organizer",
    action: "Added time option",
    detail: option.startsAt,
  });
  return saveMeetingPoll(workspaceId, next);
}

export async function archivePollOption(workspaceId: string, pollId: string, optionId: string) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  const hasVotes = poll.responses.some((r) => r.optionId === optionId);
  let next = touchPoll({
    ...poll,
    options: poll.options.map((o) => (o.id === optionId ? { ...o, archivedAt: new Date().toISOString() } : o)),
    responses: hasVotes ? poll.responses.filter((r) => r.optionId !== optionId) : poll.responses,
  });
  next = appendPollActivity(next, {
    actor: "Organizer",
    action: "Removed time option",
    detail: optionId,
  });
  return saveMeetingPoll(workspaceId, next);
}

export async function addPollParticipant(
  workspaceId: string,
  pollId: string,
  input: { name: string; email: string; contactId?: string },
) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  const dup = poll.participants.some(
    (p) => p.status !== "removed" && p.email.toLowerCase() === input.email.trim().toLowerCase(),
  );
  if (dup) throw new Error("Participant already invited");
  const participant = createParticipant(input);
  let next = touchPoll({
    ...poll,
    participants: [...poll.participants, participant],
  });
  next = appendPollActivity(next, {
    actor: "Organizer",
    action: "Participant invited",
    detail: participant.email,
  });
  return saveMeetingPoll(workspaceId, next);
}

export async function recordPollReminder(workspaceId: string, pollId: string, targetEmails: string[]) {
  const poll = await getMeetingPoll(workspaceId, pollId);
  if (!poll) return null;
  let next = appendPollActivity(poll, {
    actor: "System",
    action: "Reminder sent",
    detail: `${targetEmails.length} participant(s)`,
  });
  return saveMeetingPoll(workspaceId, next);
}

export type { MeetingPollVoteValue };
