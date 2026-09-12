import assert from "node:assert/strict";
import { buildVoicemailInboxRowModel } from "../src/lib/mctb/voicemail-inbox-row";
import type { PersonalVoicemailMessage } from "../src/lib/personal/voicemail-mappers";

function msg(partial: Partial<PersonalVoicemailMessage>): PersonalVoicemailMessage {
  return {
    id: "1",
    callerNumber: "+15555550100",
    durationSec: 42,
    createdAt: "2026-08-30T12:00:00Z",
    isRead: false,
    ...partial,
  };
}

const withName = buildVoicemailInboxRowModel(
  msg({ callerDisplayName: "Anthony Johnson", transcript: "Hi there" }),
  "Aug 30 · 12:00 PM",
);
assert.equal(withName.primary, "Anthony Johnson");
assert.equal(withName.secondary, "+1 (555) 555-0100");
assert.notEqual(withName.primary, withName.secondary);

const noName = buildVoicemailInboxRowModel(msg({ transcript: "Hello" }), "Aug 30 · 12:00 PM");
assert.equal(noName.primary, "+1 (555) 555-0100");
assert.equal(noName.secondary, "Unknown caller");
assert.notEqual(noName.primary, noName.secondary);

const noDuration = buildVoicemailInboxRowModel(msg({ durationSec: 0 }), "t");
assert.equal(noDuration.durationLabel, "—");

console.log("test-mctb-voicemail-inbox-row: ok");
