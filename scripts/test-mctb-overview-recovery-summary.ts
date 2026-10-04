/**
 * Overview recovery summary copy — per-call text sent, honest no-reply states.
 * Run: npx tsx scripts/test-mctb-overview-recovery-summary.ts
 */
import assert from "node:assert/strict";
import {
  buildOverviewRecoverySummaryText,
  buildOverviewRecoveryFooterChips,
} from "../src/lib/mctb/overview-recent-recovery-row";

const noReply = buildOverviewRecoverySummaryText({
  status: "SENT",
  smsSentAt: new Date(),
  brief: null,
  callerName: null,
});
assert.match(noReply, /has not replied yet/i);

const withBrief = buildOverviewRecoverySummaryText({
  status: "CUSTOMER_REPLIED",
  smsSentAt: new Date(),
  brief: {
    headline: "Anthony called",
    summary: "Anthony asked about services and left his email for follow-up.",
    bullets: [],
    recommendedNextStep: "Call back",
    hasVoicemail: true,
    hasTextReplies: true,
    textReplyCount: 2,
    generatedAt: new Date().toISOString(),
  },
  callerName: "Anthony Johnson",
});
assert.match(withBrief, /Anthony asked about services/);

const chips = buildOverviewRecoveryFooterChips({
  messageCount: 6,
  smsSentAt: new Date(),
  replyLabel: "Replied",
  hasVoicemail: true,
  aiRecoveryEnabled: true,
  outboundAfterOpener: true,
});
assert.ok(chips.includes("6 messages"));
assert.ok(chips.includes("Voicemail"));
assert.ok(chips.includes("AI Recovery handled"));

console.log("test-mctb-overview-recovery-summary: ok");
