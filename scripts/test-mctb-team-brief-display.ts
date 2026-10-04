/**
 * Run: npx tsx scripts/test-mctb-team-brief-display.ts
 */
import assert from "node:assert/strict";
import { tightenTeamBriefForDetail } from "../src/lib/mctb/team-brief-display";

const tightened = tightenTeamBriefForDetail({
  headline: "Missed call from Anthony",
  summary:
    "Anthony called asking what the business does. After the recovery text, he provided his email.",
  bullets: [
    "Missed call at 2026-10-04T18:17:02.324Z from +17038166017; no voicemail was left.",
    "Recovery text was sent and caller replied multiple times.",
    "Asked about your services",
    "Email: 703deuce@gmail.com",
    "No appointment, price, or promise has been made.",
    "Asked about your services",
  ],
  recommendedNextStep: "Call Anthony back.",
  hasVoicemail: false,
  hasTextReplies: true,
  textReplyCount: 2,
  generatedAt: new Date().toISOString(),
});

assert.equal(tightened.bullets.length, 2);
assert.ok(tightened.bullets.some((b) => b.includes("Email")));
assert.ok(!tightened.bullets.some((b) => b.includes("2026-10-04T")));

console.log("test-mctb-team-brief-display: ok");
