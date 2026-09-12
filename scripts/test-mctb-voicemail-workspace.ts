import assert from "node:assert/strict";
import { buildMctbGreetingLibrary } from "../src/lib/mctb/voicemail-greeting-library";
import { buildVoicemailInboxRowModel } from "../src/lib/mctb/voicemail-inbox-row";
import { sortVoicemailMessages } from "../src/lib/mctb/voicemail-display";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";

assert.equal(MCTB_ROUTES.voicemail, "/mctb/voicemail");

const lib = buildMctbGreetingLibrary({
  id: "b1",
  name: "VM",
  greetingUrl: "https://example.com/g.mp3",
  greetingText: "Hi",
});
assert.ok(lib.some((e) => e.id === "audio" && e.status === "Active"));

const row = buildVoicemailInboxRowModel(
  {
    id: "m1",
    callerNumber: "+15555550199",
    callerDisplayName: "Caller 6017",
    durationSec: 42,
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  "Aug 30",
);
assert.equal(row.primary, "Caller 6017");
assert.equal(row.isUnread, true);

const msgs = [
  {
    id: "a",
    callerNumber: "1",
    durationSec: 1,
    createdAt: "2026-01-02T00:00:00Z",
    isRead: true,
  },
  {
    id: "b",
    callerNumber: "2",
    durationSec: 1,
    createdAt: "2026-01-01T00:00:00Z",
    isRead: true,
  },
];
const sorted = sortVoicemailMessages(msgs, "newest");
assert.equal(sorted[0]?.id, "a");
const oldest = sortVoicemailMessages(msgs, "oldest");
assert.equal(oldest[0]?.id, "b");

console.log("test-mctb-voicemail-workspace: ok");
