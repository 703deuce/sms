import type { MeetingPoll as ApiMeetingPoll } from "@/lib/appointments/scheduling-capabilities";

export type PollUiStatus = "open" | "scheduled" | "closed" | "draft";

export type MeetingPollUi = {
  id: string;
  title: string;
  status: PollUiStatus;
  createdAt: string;
  closesAt: string | null;
  location: string;
  durationMinutes: number;
  organizer: string;
  invitees: number;
  responded: number;
  shareUrl: string;
  winningOptionId?: string;
  appointmentTypeId?: string;
  bookedAppointmentId?: string;
  options: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    votes: number;
  }>;
};

function pollDurationMinutes(options: ApiMeetingPoll["options"]): number {
  const first = options[0];
  if (!first) return 30;
  const ms = new Date(first.endsAt).getTime() - new Date(first.startsAt).getTime();
  return Math.max(15, Math.round(ms / 60000));
}

function pollShareUrl(pollId: string, origin?: string): string {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/poll/${pollId}`;
}

export function apiPollToUi(poll: ApiMeetingPoll, origin?: string): MeetingPollUi {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const status: PollUiStatus =
    poll.status === "booked" ? "scheduled" : poll.status === "closed" ? "closed" : "open";
  const winner = poll.options.reduce(
    (best, o) => (!best || o.votes > best.votes ? o : best),
    poll.options[0] ?? null,
  );
  return {
    id: poll.id,
    title: poll.title,
    status,
    createdAt: poll.createdAt,
    closesAt: null,
    location: "Online",
    durationMinutes: pollDurationMinutes(poll.options),
    organizer: "You",
    invitees: Math.max(totalVotes, poll.options.length),
    responded: totalVotes,
    shareUrl: pollShareUrl(poll.id, origin),
    winningOptionId: poll.status === "booked" ? winner?.id : undefined,
    appointmentTypeId: poll.appointmentTypeId,
    bookedAppointmentId: poll.bookedAppointmentId,
    options: poll.options,
  };
}

export function uiPollToApi(poll: MeetingPollUi, workspaceId: string): ApiMeetingPoll {
  const status =
    poll.status === "scheduled" ? "booked" : poll.status === "closed" ? "closed" : "open";
  return {
    id: poll.id,
    workspaceId,
    title: poll.title,
    appointmentTypeId: poll.appointmentTypeId,
    options: poll.options.map((o) => ({
      id: o.id,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      votes: o.votes,
    })),
    status,
    bookedAppointmentId: poll.bookedAppointmentId,
    createdAt: poll.createdAt,
  };
}
