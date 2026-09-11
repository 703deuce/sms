import "server-only";

import { getPrisma } from "@/lib/db";
import { listMeetingPolls } from "@/lib/appointments/meeting-polls";
import { scoreMeetingPoll, respondedParticipantCount, activeParticipantCount } from "./scoring";
import { derivePollStatus, publicPollUrl } from "./model";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";

export type MeetingPollLibraryRow = {
  id: string;
  title: string;
  status: string;
  optionCount: number;
  participantCount: number;
  respondedCount: number;
  bestTimeLabel: string | null;
  deadlineAt: string | null;
  updatedAt: string;
  appointmentId: string | null;
};

function formatBestTime(poll: MeetingPoll, optionId: string | null): string | null {
  if (!optionId) return null;
  const opt = poll.options.find((o) => o.id === optionId);
  if (!opt) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: poll.timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(opt.startsAt));
}

export async function buildMeetingPollsWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, displayName: true, name: true },
  });
  const polls = await listMeetingPolls(workspaceId);
  const rows: MeetingPollLibraryRow[] = polls.map((poll) => {
    const derived = derivePollStatus(poll);
    const { bestOptionId } = scoreMeetingPoll(poll);
    return {
      id: poll.id,
      title: poll.title,
      status: derived,
      optionCount: poll.options.filter((o) => !o.archivedAt).length,
      participantCount: activeParticipantCount(poll),
      respondedCount: respondedParticipantCount(poll),
      bestTimeLabel: formatBestTime(poll, bestOptionId),
      deadlineAt: poll.deadlineAt || null,
      updatedAt: poll.updatedAt,
      appointmentId: poll.bookedAppointmentId || null,
    };
  });
  return {
    workspaceSlug: workspace?.slug || "",
    workspaceName: workspace?.displayName || workspace?.name || "Workspace",
    polls: rows,
    pollDetails: polls.map((p) => ({
      ...p,
      derivedStatus: derivePollStatus(p),
      publicUrl: workspace?.slug ? publicPollUrl(workspace.slug, p.shareToken) : "",
      scoreboard: scoreMeetingPoll(p),
    })),
  };
}
