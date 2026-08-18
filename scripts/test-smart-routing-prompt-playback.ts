/**
 * Hermetic prompt TwiML helpers for Smart Routing.
 * Run: npx tsx scripts/test-smart-routing-prompt-playback.ts
 */
import assert from "node:assert/strict";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function promptToTwimlInner(playback: { playUrl?: string; sayText?: string }): string {
  if (playback.playUrl) return `<Play>${escapeXml(playback.playUrl)}</Play>`;
  if (playback.sayText) return `<Say>${escapeXml(playback.sayText)}</Say>`;
  return "";
}

assert.equal(promptToTwimlInner({ sayText: "Hello" }), "<Say>Hello</Say>");
assert.equal(
  promptToTwimlInner({ playUrl: "https://example.com/a.mp3" }),
  "<Play>https://example.com/a.mp3</Play>",
);

console.log("test-smart-routing-prompt-playback: ok");
