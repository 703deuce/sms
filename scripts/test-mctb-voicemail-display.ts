import assert from "node:assert/strict";
import {
  sortVoicemailMessages,
  voicemailMinutesThisMonth,
  formatVoicemailDuration,
} from "../src/lib/mctb/voicemail-display";
import type { PersonalVoicemailMessage } from "../src/lib/personal/voicemail-mappers";

function msg(id: string, createdAt: string, durationSec: number | null = 30): PersonalVoicemailMessage {
  return {
    id,
    callerNumber: "+15551234567",
    durationSec,
    createdAt,
    isRead: false,
    readAt: null,
  };
}

const sorted = sortVoicemailMessages(
  [msg("a", "2026-01-02T12:00:00Z"), msg("b", "2026-01-03T12:00:00Z")],
  "newest",
);
assert.equal(sorted[0].id, "b");

const oldest = sortVoicemailMessages(
  [msg("a", "2026-01-02T12:00:00Z"), msg("b", "2026-01-03T12:00:00Z")],
  "oldest",
);
assert.equal(oldest[0].id, "a");

const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString();
const minutes = voicemailMinutesThisMonth([
  msg("1", thisMonth, 120),
  msg("2", lastMonth, 600),
]);
assert.equal(minutes, 2);

assert.equal(formatVoicemailDuration(42), "0:42");
assert.equal(formatVoicemailDuration(125), "2:05");
assert.equal(formatVoicemailDuration(0), "—");
assert.equal(formatVoicemailDuration(null), "—");

console.log("test-mctb-voicemail-display: ok");
