#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  resolveMctbForwardingVerifiedForUi,
  resolveMctbLiveRecoveryProvenForUi,
} from "../src/lib/mctb/forwarding-verified-ui";

assert.equal(
  resolveMctbForwardingVerifiedForUi({
    setupTest: { verified: true } as never,
  }),
  true,
);

assert.equal(
  resolveMctbLiveRecoveryProvenForUi({
    liveTest: {
      passed: false,
      checks: {
        forwardingVerified: true,
        missedCall: true,
        consentCompleted: true,
        textSent: true,
      },
    } as never,
  }),
  true,
);

console.log("test-mctb-forwarding-verified-ui: OK");
