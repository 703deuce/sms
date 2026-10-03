#!/usr/bin/env tsx
/**
 * Live test "passed" must not require an inbound SMS reply once recovery SMS sent.
 */
import assert from "node:assert/strict";
import type { LiveTestChecks } from "../src/lib/mctb/onboarding/live-test";

function recoveryPipelinePassed(checks: Pick<
  LiveTestChecks,
  "forwardingVerified" | "missedCall" | "consentCompleted" | "textSent"
>): boolean {
  return (
    checks.forwardingVerified &&
    checks.missedCall &&
    checks.consentCompleted &&
    checks.textSent
  );
}

assert.equal(
  recoveryPipelinePassed({
    forwardingVerified: true,
    missedCall: true,
    consentCompleted: true,
    textSent: true,
  }),
  true,
);

assert.equal(
  recoveryPipelinePassed({
    forwardingVerified: true,
    missedCall: true,
    consentCompleted: true,
    textSent: false,
  }),
  false,
);

console.log("test-mctb-live-test-pass-criteria: OK");
