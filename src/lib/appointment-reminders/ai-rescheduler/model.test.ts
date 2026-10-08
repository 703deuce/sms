import assert from "node:assert/strict";
import { AR_AI_RESCHEDULER_MODEL_ID, getArAiReschedulerModelId } from "./model";

assert.equal(AR_AI_RESCHEDULER_MODEL_ID, "gpt-6-luna");
assert.equal(getArAiReschedulerModelId(), "gpt-6-luna");
console.log("ar-ai-rescheduler-model.test.ts: PASS");
