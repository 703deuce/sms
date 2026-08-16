import assert from "node:assert/strict";
import { ChatContext } from "@livekit/agents";
import {
  buildReceptionistConversationRecap,
  callerUtterancesFromChatCtx,
} from "../src/lib/voice/receptionist/conversation-recap";

const ctx = ChatContext.empty();
ctx.addMessage({ role: "user", content: "I need to book an appointment." });
ctx.addMessage({ role: "assistant", content: "What's your name?" });
ctx.addMessage({ role: "user", content: "Anthony Johnson." });
ctx.addMessage({ role: "user", content: "571-477-6175." });

const utterances = callerUtterancesFromChatCtx(ctx);
assert.equal(utterances.length, 3);
assert.ok(utterances[0].includes("book"));

const recap = buildReceptionistConversationRecap({
  chatCtx: ctx,
  receptionistFields: { name: "Anthony Johnson", phone: "+15714776175" },
  fieldManifest: [
    {
      id: "name",
      label: "Name",
      question: "Name?",
      type: "text",
      required: true,
    },
    {
      id: "email",
      label: "Email",
      question: "Email?",
      type: "email",
      required: false,
      askWhen: "when_booking",
    },
  ],
  purpose: "booking",
});

assert.ok(recap.includes("Anthony Johnson"));
assert.ok(recap.includes("571-477-6175"));
assert.ok(recap.includes("Still missing"));
assert.ok(recap.includes("email"));

console.log("test-conversation-recap: ok");
