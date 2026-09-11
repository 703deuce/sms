import assert from "node:assert/strict";
import { scoreMeetingPoll, tallyPollResponses } from "../src/lib/appointments/meeting-polls/scoring";
import { wallTimeInZoneToUtc } from "../src/lib/voice/calendar/timezone-slots";
import type { MeetingPoll } from "../src/lib/appointments/scheduling-capabilities";
import { DEFAULT_POLL_SETTINGS } from "../src/lib/appointments/meeting-polls/model";

function basePoll(overrides: Partial<MeetingPoll> = {}): MeetingPoll {
  return {
    id: "poll_test",
    workspaceId: "ws",
    title: "Test",
    timezone: "America/New_York",
    durationMinutes: 30,
    options: [
      { id: "o1", startsAt: "2026-09-18T14:00:00.000Z", endsAt: "2026-09-18T14:30:00.000Z" },
      { id: "o2", startsAt: "2026-09-18T18:00:00.000Z", endsAt: "2026-09-18T18:30:00.000Z" },
      { id: "o3", startsAt: "2026-09-19T15:00:00.000Z", endsAt: "2026-09-19T15:30:00.000Z" },
    ],
    participants: [
      { id: "p1", name: "A", email: "a@test.com", inviteToken: "t1", status: "responded" },
      { id: "p2", name: "B", email: "b@test.com", inviteToken: "t2", status: "responded" },
    ],
    responses: [],
    settings: DEFAULT_POLL_SETTINGS,
    activity: [],
    status: "open",
    shareToken: "tok",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Test 4 — scoring
{
  const poll = basePoll({
    responses: [
      { participantId: "p1", optionId: "o1", value: "no", updatedAt: "" },
      { participantId: "p2", optionId: "o1", value: "no", updatedAt: "" },
      { participantId: "p1", optionId: "o2", value: "yes", updatedAt: "" },
      { participantId: "p2", optionId: "o2", value: "yes", updatedAt: "" },
      { participantId: "p1", optionId: "o3", value: "maybe", updatedAt: "" },
      { participantId: "p2", optionId: "o3", value: "no", updatedAt: "" },
    ],
  });
  const { bestOptionId } = scoreMeetingPoll(poll);
  assert.equal(bestOptionId, "o2");
}

// Test 5 — timezone display same instant
{
  const eastern = wallTimeInZoneToUtc("America/New_York", 2026, 9, 18, 14, 0);
  const fmtPacific = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(eastern);
  assert.match(fmtPacific, /11:00\s*AM/i);
}

console.log("meeting-polls unit tests: PASS");
