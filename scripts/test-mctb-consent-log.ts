#!/usr/bin/env npx tsx
/**
 * Contract test for MCTB consent log loader.
 * Run: npx tsx scripts/test-mctb-consent-log.ts
 */
import assert from "node:assert/strict";
import { missedCallIdempotencyKey } from "../src/lib/mctb/consent-log-shared";

assert.equal(
  missedCallIdempotencyKey("ws_123", "SCL_abc"),
  "missed-call-text:ws_123:SCL_abc",
);

console.log("test-mctb-consent-log: ok");
