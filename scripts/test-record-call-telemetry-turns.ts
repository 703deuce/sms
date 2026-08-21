import assert from "node:assert/strict";
import { mergeTurnLatency } from "../src/lib/voice/python-runtime-bridge/record-call-telemetry-for-python";

const merged1 = mergeTurnLatency({}, {
  turnNumber: 1,
  userToAgentResponseMs: null,
  responseMsFromCallStart: 4200,
  responseSource: "agent_speech_committed",
  proactive: true,
});
assert.equal(merged1.turnCount, 1);
assert.deepEqual((merged1.turnLatencies as Array<{ turnNumber: number }>)[0]?.turnNumber, 1);

const merged2 = mergeTurnLatency(merged1 as Record<string, unknown>, {
  turnNumber: 2,
  userToAgentResponseMs: 850,
  responseMsFromCallStart: 12000,
  responseSource: "agent_speech_committed",
  proactive: false,
});
assert.equal(merged2.turnCount, 2);
assert.equal(merged2.avgUserToAgentResponseMs, 850);
assert.equal(merged2.lastUserToAgentResponseMs, 850);

console.log("test-record-call-telemetry-turns: ok");
