import "server-only";

import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { getMeetingPollByShareToken, getMeetingPollByParticipantToken } from "@/lib/appointments/meeting-polls";
import type { MeetingPollVoteValue } from "@/lib/appointments/scheduling-capabilities";
import { appendPollActivity, derivePollStatus, touchPoll } from "./model";
import { scoreMeetingPoll } from "./scoring";

export async function loadPublicPollBySlugAndToken(workspaceSlug: string, token: string) {
  const workspace = await resolveWorkspaceBySlug(workspaceSlug);
  if (!workspace) return null;
  const poll = await getMeetingPollByShareToken(workspace.id, token);
  if (!poll) return null;
  const platform = await loadAppointmentPlatformConfig(workspace.id);
  return {
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.displayName || workspace.name,
    },
    poll,
    derivedStatus: derivePollStatus(poll),
    scoreboard: scoreMeetingPoll(poll),
    timezoneDefault: poll.timezone,
    businessTimezone: platform.timezone || poll.timezone,
  };
}

export async function loadPublicPollByParticipantToken(workspaceSlug: string, inviteToken: string) {
  const workspace = await resolveWorkspaceBySlug(workspaceSlug);
  if (!workspace) return null;
  const poll = await getMeetingPollByParticipantToken(workspace.id, inviteToken);
  if (!poll) return null;
  const participant = poll.participants.find((p) => p.inviteToken === inviteToken);
  if (!participant) return null;
  return {
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.displayName || workspace.name,
    },
    poll,
    participant,
    derivedStatus: derivePollStatus(poll),
    scoreboard: scoreMeetingPoll(poll),
  };
}

export async function submitParticipantResponses(input: {
  workspaceId: string;
  pollId: string;
  participantId: string;
  responses: Array<{ optionId: string; value: MeetingPollVoteValue }>;
  comment?: string;
}) {
  const { listMeetingPolls, saveMeetingPoll: save } = await import("@/lib/appointments/meeting-polls");
  const polls = await listMeetingPolls(input.workspaceId);
  const poll = polls.find((p) => p.id === input.pollId);
  if (!poll) throw new Error("Poll not found");
  const status = derivePollStatus(poll);
  if (status === "closed" || status === "finalized" || status === "cancelled") {
    throw new Error("Poll is not accepting responses");
  }
  if (!poll.settings.allowResponseChanges && poll.participants.find((p) => p.id === input.participantId)?.status === "responded") {
    const existing = poll.responses.some((r) => r.participantId === input.participantId);
    if (existing) throw new Error("Response changes are not allowed");
  }

  const now = new Date().toISOString();
  const activeOptionIds = new Set(poll.options.filter((o) => !o.archivedAt).map((o) => o.id));
  const filtered = input.responses.filter((r) => activeOptionIds.has(r.optionId));
  const withoutParticipant = poll.responses.filter((r) => r.participantId !== input.participantId);
  const nextResponses = [
    ...withoutParticipant,
    ...filtered.map((r) => ({
      participantId: input.participantId,
      optionId: r.optionId,
      value: r.value,
      updatedAt: now,
    })),
  ];

  let next = touchPoll({
    ...poll,
    responses: nextResponses,
    participants: poll.participants.map((p) =>
      p.id === input.participantId
        ? {
            ...p,
            status: "responded",
            lastActivityAt: now,
            comment: input.comment ?? p.comment,
          }
        : p,
    ),
  });
  next = appendPollActivity(next, {
    actor: poll.participants.find((p) => p.id === input.participantId)?.name || "Participant",
    action: "Submitted availability",
  });
  await save(input.workspaceId, next);
  return next;
}
