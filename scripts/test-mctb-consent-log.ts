#!/usr/bin/env npx tsx
/**
 * Contract test for MCTB consent log loader.
 * Run: npx tsx scripts/test-mctb-consent-log.ts
 */
import assert from "node:assert/strict";
import {
  buildConsentLogScopeFromMissedEvents,
  buildConsentLogWhereClause,
  missedCallIdempotencyKey,
} from "../src/lib/mctb/consent-log-shared";

assert.equal(
  missedCallIdempotencyKey("ws_123", "SCL_abc"),
  "missed-call-text:ws_123:SCL_abc",
);

const scope = buildConsentLogScopeFromMissedEvents("ws_1", [
  {
    id: "evt_1",
    status: "SENT",
    smsSentAt: null,
    idempotencyKey: "missed-call-text:ws_1:SCL_test",
    metadata: { providerCallId: "SCL_alt" },
  },
]);
assert.ok(scope.sessionIds.includes("SCL_test"));
assert.ok(scope.sessionIds.includes("SCL_alt"));

const where = buildConsentLogWhereClause("ws_1", scope.sessionIds);
assert.ok(Array.isArray((where.OR as unknown[])));

console.log("test-mctb-consent-log: ok");
