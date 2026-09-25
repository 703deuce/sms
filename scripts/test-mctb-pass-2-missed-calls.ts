#!/usr/bin/env tsx
/**
 * MCTB Pass 2 — missed calls list/detail presentation contracts.
 * Run: npx tsx scripts/test-mctb-pass-2-missed-calls.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatRecoveryStatus } from "../src/lib/mctb/recovery-display";
import { presentRecoverySuppression } from "../src/lib/mctb/recovery-suppression-presentation";
import {
  deriveMissedCallConversationPresentation,
  deriveMissedCallNextAction,
} from "../src/lib/mctb/missed-calls-row-presentation";
import { formatMissedCallLocalListTime } from "../src/lib/mctb/missed-calls-time";

assert.notEqual(formatRecoveryStatus("SUPPRESSED", "OPTED_OUT"), "Failed");
assert.equal(formatRecoveryStatus("FAILED", null), "Failed");

const press1 = presentRecoverySuppression("NOT_EXISTING_CONSENT", "SUPPRESSED");
assert.match(press1.explanation, /did not press 1/i);
assert.equal(press1.category, "suppressed");

const cooldown = presentRecoverySuppression("COOLDOWN_ACTIVE", "SUPPRESSED");
assert.match(cooldown.explanation, /recently sent/i);

const unknown = presentRecoverySuppression(null, "DETECTED");
assert.equal(unknown.unknown, true);

const conv = deriveMissedCallConversationPresentation({
  status: "CUSTOMER_REPLIED",
  automationState: "automation_active",
});
assert.equal(conv.label, "AI Recovery active");

assert.equal(
  deriveMissedCallConversationPresentation({ status: "SENT" }).label,
  "No reply",
);

const next = deriveMissedCallNextAction({
  status: "CUSTOMER_REPLIED",
  suppressionReason: null,
  conversationId: "c1",
});
assert.equal(next.kind, "open_conversation");

const tzLine = formatMissedCallLocalListTime(new Date().toISOString(), "America/New_York");
assert.ok(tzLine.length > 3);

const listPage = readFileSync("src/app/(app)/mctb/missed-calls/page.tsx", "utf8");
const detailPage = readFileSync("src/app/(app)/mctb/missed-calls/[id]/page.tsx", "utf8");
assert.match(listPage, /mctb\/missed-calls/);
assert.match(detailPage, /MctbMissedCallDetailView/);

const listView = readFileSync("src/components/mctb/missed-calls-view.tsx", "utf8");
assert.match(listView, /Next action/);
assert.match(listView, /presentRecoverySuppression|recoveryListSecondaryLine/);

const detailView = readFileSync("src/components/mctb/missed-call-detail-view.tsx", "utf8");
assert.match(detailView, /Why wasn’t a recovery text sent/);
assert.match(detailView, /Captured recovery information/);
assert.doesNotMatch(detailView, /SUPPRESSION_COOLDOWN/);

console.log("test-mctb-pass-2-missed-calls: OK");
