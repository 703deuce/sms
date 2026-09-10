import type { MeetingPoll as BackendPoll } from "@/lib/appointments/scheduling-capabilities";
import type { MeetingPoll as UiPoll, PollStatus } from "@/components/appointments/kimi-ui/meeting-polls/types";

function mapStatus(status: BackendPoll["status"]): PollStatus {
  if (status === "booked") return "scheduled";
  if (status === "open" || status === "closed") return status;
  return "closed";
}

function pollShareUrl(pollId: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "https://book.transovo.com";
  return `${base.replace(/\/$/, "")}/poll/${pollId}`;
}

export function mapBackendPollToUi(
  poll: BackendPoll,
  ctx?: {
    origin?: string;
    appointmentTypeName?: string;
    durationMinutes?: number;
    organizerName?: string;
  },
): UiPoll {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const winningOptionId =
    poll.options.length > 0
      ? [...poll.options].sort((a, b) => b.votes - a.votes)[0]?.id
      : undefined;

  const firstOption = poll.options[0];
  const durationMinutes =
    ctx?.durationMinutes ??
    (firstOption
      ? Math.max(
          15,
          Math.round(
            (new Date(firstOption.endsAt).getTime() - new Date(firstOption.startsAt).getTime()) /
              60000,
          ),
        )
      : 30);

  return {
    id: poll.id,
    title: poll.title,
    status: mapStatus(poll.status),
    createdAt: poll.createdAt,
    closesAt: null,
    location: ctx?.appointmentTypeName || "Meeting",
    durationMinutes,
    organizer: ctx?.organizerName || "Workspace",
    invitees: totalVotes,
    responded: totalVotes,
    shareUrl: pollShareUrl(poll.id, ctx?.origin),
    winningOptionId,
    appointmentTypeId: poll.appointmentTypeId,
    options: poll.options.map((o) => ({
      id: o.id,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      votes: o.votes,
    })),
  };
}
