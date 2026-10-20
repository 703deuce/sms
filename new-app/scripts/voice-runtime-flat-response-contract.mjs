/**
 * Contract check: Python voice worker expects flat JSON from POST /api/internal/voice-runtime
 * (same as monolith transovo-web). Wrapped `{ ok: true, result }` breaks amyInstructions on PSTN.
 */
import assert from "node:assert/strict";

function unwrapLegacyWrapped(parsed) {
  if (parsed?.ok === true && parsed?.result && typeof parsed.result === "object") {
    return parsed.result;
  }
  return parsed;
}

const wrapped = {
  ok: true,
  result: { liveSessionId: "lk_x", amyInstructions: "long prompt", liveVoiceId: "marin" },
};
const flat = unwrapLegacyWrapped(wrapped);
assert.equal(flat.liveSessionId, "lk_x");
assert.equal(flat.amyInstructions, "long prompt");
assert.equal(unwrapLegacyWrapped(flat).amyInstructions, "long prompt");

console.log("voice-runtime flat response contract: PASS");
