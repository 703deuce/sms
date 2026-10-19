import assert from "node:assert/strict";

const LEGACY = { aria: "marin", theo: "cedar", june: "coral" };
const OPENAI = ["marin", "coral", "shimmer", "cedar", "sage", "verse", "alloy", "echo", "ash", "ballad"];

function normalize(raw) {
  const lower = String(raw || "").trim().toLowerCase();
  if (OPENAI.includes(lower)) return lower;
  return LEGACY[lower] || "marin";
}

assert.equal(normalize("aria"), "marin");
assert.equal(normalize("coral"), "coral");
assert.ok(OPENAI.includes("marin"));

console.log("test-telephony-voice-catalog: PASS");
