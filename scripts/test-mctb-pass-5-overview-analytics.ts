import assert from "node:assert/strict";
import {
  computeFunnelCounts,
  isRecoveryTextSent,
  safeRatePercent,
} from "../src/lib/mctb/analytics-metric-definitions";
import { analyticsRangeBounds, workspaceCalendarDateKey } from "../src/lib/mctb/workspace-timezone";
import { MCTB_LAUNCH_COMPACT_OVERVIEW } from "../src/lib/mctb/launch-flags";
import { buildMctbRecentActivity } from "../src/lib/mctb/overview-recent-activity";
import type { MctbOverviewPayload } from "../src/lib/mctb/overview-types";

const rows = [
  {
    status: "DETECTED",
    suppressionReason: null,
    smsSentAt: null,
    eligible: false,
    detectedAt: new Date(),
  },
  {
    status: "SUPPRESSED",
    suppressionReason: "OPTED_OUT",
    smsSentAt: null,
    eligible: false,
    detectedAt: new Date(),
  },
  {
    status: "FAILED",
    suppressionReason: null,
    smsSentAt: null,
    eligible: true,
    detectedAt: new Date(),
  },
  {
    status: "SENT",
    suppressionReason: null,
    smsSentAt: new Date(),
    eligible: true,
    detectedAt: new Date(),
  },
  {
    status: "CUSTOMER_REPLIED",
    suppressionReason: null,
    smsSentAt: new Date(),
    eligible: true,
    detectedAt: new Date(),
  },
];

const funnel = computeFunnelCounts(rows);
assert.equal(funnel.totalMissed, 5);
assert.equal(funnel.eligible, 3);
assert.equal(funnel.textsSent, 2);
assert.equal(funnel.replies, 1);
assert.equal(funnel.suppressed, 1);
assert.equal(funnel.deliveryFailures, 1);
assert.equal(funnel.replyRate, safeRatePercent(1, 2));
assert.equal(safeRatePercent(1, 0), 0);

assert.equal(isRecoveryTextSent({ ...rows[3], smsSentAt: null, status: "SENT" }), false);

const bounds = analyticsRangeBounds("7d", "America/New_York");
assert.equal(bounds.dayKeys.length, 7);
assert.ok(bounds.since instanceof Date);

const key = workspaceCalendarDateKey(new Date("2026-01-15T18:00:00Z"), "America/New_York");
assert.match(key, /^\d{4}-\d{2}-\d{2}$/);

assert.equal(MCTB_LAUNCH_COMPACT_OVERVIEW, true);

const sampleOverview: MctbOverviewPayload = {
  status: "active",
  statusLabel: "Active",
  pausedUntil: null,
  setupComplete: true,
  kpis: {
    windowLabel: "Today",
    timeZone: "America/New_York",
    missedCallsToday: 1,
    recoveryTextsToday: 1,
    repliesToday: 0,
    needsReplyCount: 0,
  },
  recentMissedCalls: [
    {
      id: "mc1",
      callerName: null,
      callerPhoneE164: "+15551112222",
      callerPhoneLabel: "(555) 111-2222",
      callerLabel: "(555) 111-2222",
      missedAt: new Date().toISOString(),
      recoveryLabel: "Sent",
      replyLabel: "No reply",
      summaryText:
        "Missed call from a new caller. Transovo sent the recovery text, but the caller has not replied yet.",
      footerChips: ["Text delivered", "No reply yet"],
      conversationId: null,
      teamBriefHeadline: null,
      teamBriefSummary: null,
    },
  ],
  recentConversations: [],
  setupHealth: {
    businessLine: null,
    forwardingLabel: "Verified",
    consentLabel: "Press-1 consent",
    senderLabel: "Ready",
    recoveryLabel: "Active",
    voicemailLabel: null,
  },
  performanceSnapshot: null,
  leadRecovery: {
    enabled: true,
    activePolicyCount: 1,
    policySummary: "Booking",
    status: "ready",
    statusLabel: "Ready",
    attentionReason: null,
    attentionHref: null,
  },
  callHandling: {
    mode: "MCTB_RECOVERY",
    modeLabel: "Missed call recovery",
    forwardingLabel: "Already connected",
    ingressE164: null,
  },
};

const activity = buildMctbRecentActivity(sampleOverview);
assert.equal(activity.length, 1);
assert.ok(activity[0].href.includes("/mctb/missed-calls/"));

console.log("test-mctb-pass-5-overview-analytics: OK");
