#!/usr/bin/env tsx
/**
 * Same-number mode switching — parse + policy unit tests (no DB).
 * npx tsx scripts/test-mctb-inbound-handling-mode.ts
 */
import assert from "node:assert/strict";
import { readInboundHandlingMode } from "../src/lib/mctb/inbound-handling/line-config-parse";
import { INBOUND_HANDLING_MODES } from "../src/lib/mctb/inbound-handling/types";

assert.deepEqual(INBOUND_HANDLING_MODES, ["MCTB_RECOVERY", "VOICE_AGENT"]);

assert.equal(
  readInboundHandlingMode({ mctbInbound: { inboundHandlingMode: "VOICE_AGENT" } }),
  "VOICE_AGENT",
);
assert.equal(readInboundHandlingMode({}), "MCTB_RECOVERY");
assert.equal(
  readInboundHandlingMode({ mctbInbound: { inboundHandlingMode: "invalid" } }),
  "MCTB_RECOVERY",
);

console.log("test-mctb-inbound-handling-mode: PASS");
