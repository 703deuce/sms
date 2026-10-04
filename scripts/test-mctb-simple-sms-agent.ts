#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const customerSms = readFileSync(
  "src/lib/agents/missed-call-text-back/customer-sms.ts",
  "utf8",
);
assert.match(customerSms, /handleMctbSimpleSmsAgentInbound/);
assert.doesNotMatch(customerSms, /handleMctbSmsConversationPipeline/);

const agent = readFileSync("src/lib/mctb/ai-recovery/simple-sms-agent.ts", "utf8");
assert.match(agent, /business_knowledge/);
assert.match(agent, /conversation_thread/);
assert.match(agent, /includeCollectPrompts: false/);
assert.doesNotMatch(agent, /evaluateLeadRecoveryPolicy/);
assert.doesNotMatch(agent, /runLeadRecoveryIntentAgent/);

const bookingConfig = readFileSync("src/lib/mctb/ai-booking/config.ts", "utf8");
assert.match(bookingConfig, /smsPipelinePrimary: false/);

assert.match(
  readFileSync("package.json", "utf8"),
  /test:mctb-simple-sms-dialogue-smoke/,
);
assert.match(
  readFileSync("src/lib/mctb/ai-recovery/simple-sms-agent.ts", "utf8"),
  /runMctbSimpleSmsAgentTurn/,
);

console.log("test-mctb-simple-sms-agent: OK");
