import type { MeetingPoll, MeetingPollOption, MeetingPollResponse } from "@/lib/appointments/scheduling-capabilities";

export type OptionTally = {
  optionId: string;
  yes: number;
  maybe: number;
  no: number;
  score: number;
  rank: number;
  isBest: boolean;
};

export type PollScoreboard = {
  tallies: OptionTally[];
  bestOptionId: string | null;
};

/** Transparent ranking — see docs/APPOINTMENTS-MEETING-POLL-SCORING.md */
export function tallyPollResponses(
  poll: Pick<MeetingPoll, "options" | "responses" | "participants">,
): Record<string, { yes: number; maybe: number; no: number }> {
  const activeParticipantIds = new Set(
    poll.participants.filter((p) => p.status !== "removed").map((p) => p.id),
  );
  const activeOptions = poll.options.filter((o) => !o.archivedAt);
  const map: Record<string, { yes: number; maybe: number; no: number }> = {};
  for (const o of activeOptions) {
    map[o.id] = { yes: 0, maybe: 0, no: 0 };
  }
  for (const r of poll.responses) {
    if (!activeParticipantIds.has(r.participantId)) continue;
    if (!map[r.optionId]) continue;
    if (r.value === "yes") map[r.optionId].yes += 1;
    else if (r.value === "maybe") map[r.optionId].maybe += 1;
    else map[r.optionId].no += 1;
  }
  return map;
}

function compareOptions(
  a: MeetingPollOption,
  b: MeetingPollOption,
  tallies: Record<string, { yes: number; maybe: number; no: number }>,
): number {
  const ta = tallies[a.id] || { yes: 0, maybe: 0, no: 0 };
  const tb = tallies[b.id] || { yes: 0, maybe: 0, no: 0 };
  if (tb.yes !== ta.yes) return tb.yes - ta.yes;
  if (ta.no !== tb.no) return ta.no - tb.no;
  if (tb.maybe !== ta.maybe) return tb.maybe - ta.maybe;
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

export function scoreMeetingPoll(poll: Pick<MeetingPoll, "options" | "responses" | "participants">): PollScoreboard {
  const tallies = tallyPollResponses(poll);
  const activeOptions = poll.options.filter((o) => !o.archivedAt);
  const sorted = [...activeOptions].sort((a, b) => compareOptions(a, b, tallies));
  const best = sorted[0];
  const bestOptionId = best ? best.id : null;
  const optionTallies: OptionTally[] = sorted.map((o, idx) => {
    const t = tallies[o.id] || { yes: 0, maybe: 0, no: 0 };
    const score = t.yes * 1000 - t.no * 100 + t.maybe;
    return {
      optionId: o.id,
      yes: t.yes,
      maybe: t.maybe,
      no: t.no,
      score,
      rank: idx + 1,
      isBest: o.id === bestOptionId,
    };
  });
  return { tallies: optionTallies, bestOptionId };
}

export function respondedParticipantCount(poll: MeetingPoll): number {
  const responded = new Set<string>();
  for (const r of poll.responses) responded.add(r.participantId);
  return poll.participants.filter((p) => p.status !== "removed" && responded.has(p.id)).length;
}

export function activeParticipantCount(poll: MeetingPoll): number {
  return poll.participants.filter((p) => p.status !== "removed").length;
}
