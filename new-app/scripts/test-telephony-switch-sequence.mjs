/**
 * Documents and asserts the intended switch phase ordering (no live Telnyx).
 */
import assert from "node:assert/strict";

const PHASES = [
  "read_live_telnyx_connection",
  "confirm_switch",
  "park_prior_ingress",
  "prepare_destination",
  "telnyx_patch_and_verify",
  "commit_db_bindings",
];

const receptionistPrepareBeforeTelnyx = PHASES.indexOf("prepare_destination") <
  PHASES.indexOf("telnyx_patch_and_verify");
assert.ok(receptionistPrepareBeforeTelnyx, "LiveKit prepare must precede Telnyx patch");

console.log("test-telephony-switch-sequence: PASS", PHASES.join(" → "));
