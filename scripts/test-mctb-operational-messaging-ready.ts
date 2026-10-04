import assert from "node:assert/strict";
import {
  isMctbOperationalMessagingReady,
  isMctbSetupMessagingReady,
} from "@/lib/mctb/setup-messaging-ready";
import { chatCompletionTokenFields } from "@/lib/ai/llm-providers";

assert.equal(
  isMctbSetupMessagingReady({ phoneNumbers: [], requiredActions: ["brand"] }),
  false,
);
assert.equal(
  isMctbOperationalMessagingReady({ messagingReady: false, platformSenderActive: true }),
  true,
);
assert.equal(
  isMctbOperationalMessagingReady({ messagingReady: true, platformSenderActive: false }),
  true,
);
assert.equal(
  isMctbOperationalMessagingReady({ messagingReady: false, platformSenderActive: false }),
  false,
);

const gpt5 = chatCompletionTokenFields("openai", "gpt-5-nano", 120);
assert.ok("max_completion_tokens" in gpt5 && gpt5.max_completion_tokens === 120);
assert.ok(!("max_tokens" in gpt5));

const legacy = chatCompletionTokenFields("openai", "gpt-4o-mini", 120);
assert.ok(legacy.max_tokens === 120);

console.log("test-mctb-operational-messaging-ready: PASS");
