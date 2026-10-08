import assert from "node:assert/strict";
import { appendCurrentInboundIfNeeded } from "./luna-conversation-merge";

const base = [
  { role: "assistant" as const, content: "Oct 13 at 9:00 AM is available. Would you like that?" },
];

assert.deepEqual(
  appendCurrentInboundIfNeeded(base, [], "Yes"),
  [...base, { role: "user", content: "Yes" }],
);

assert.deepEqual(
  appendCurrentInboundIfNeeded(
    [...base, { role: "user", content: "Yes" }],
    [{ providerMessageId: "msg-1" }],
    "Yes",
    "msg-1",
  ),
  [...base, { role: "user", content: "Yes" }],
  "provider id match must not duplicate current inbound",
);

console.log("luna-conversation-context.test.ts: PASS");
