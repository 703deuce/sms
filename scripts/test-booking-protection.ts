#!/usr/bin/env tsx
/**
 * AI Booking Protection policy tests.
 * Run: npx tsx scripts/test-booking-protection.ts
 */
import assert from "node:assert/strict";
import {
  classifyBookingHeuristics,
  isDisposableEmail,
  looksGibberish,
  resolveBookingProtectionAction,
} from "../src/lib/appointments/booking-protection-policy";

function testHoneypotBlocks() {
  const result = classifyBookingHeuristics({
    phone: "+15551234567",
    honeypot: "spam",
    ipAttempts: 0,
  });
  assert.ok(result.riskScore >= 70);
  assert.ok(result.signals.includes("honeypot_filled"));
  console.log("PASS honeypot increases risk");
}

function testDisposableEmail() {
  assert.equal(isDisposableEmail("x@mailinator.com"), true);
  assert.equal(isDisposableEmail("x@company.com"), false);
  console.log("PASS disposable email detection");
}

function testGibberishName() {
  assert.equal(looksGibberish("bbbbbbbbb"), true);
  assert.equal(looksGibberish("Jane Smith"), false);
  console.log("PASS gibberish detection");
}

function testMediumChallengeStandard() {
  const eval_ = classifyBookingHeuristics({
    phone: "+15551234567",
    formStartedAt: Date.now() - 500,
    ipAttempts: 5,
  });
  const action = resolveBookingProtectionAction(eval_, "standard");
  assert.equal(action.action, "challenge");
  console.log("PASS medium risk challenges in standard mode");
}

function testHighBlock() {
  const eval_ = classifyBookingHeuristics({
    phone: "123",
    honeypot: "bot",
    ipAttempts: 10,
  });
  const action = resolveBookingProtectionAction(eval_, "standard");
  assert.equal(action.action, "block");
  console.log("PASS high risk blocks");
}

function testHumanVerificationAllowsMedium() {
  const eval_ = classifyBookingHeuristics({
    phone: "+15551234567",
    formStartedAt: Date.now() - 500,
    ipAttempts: 5,
  });
  const action = resolveBookingProtectionAction(eval_, "standard", true);
  assert.equal(action.action, "allow");
  console.log("PASS human verification allows medium risk");
}

testHoneypotBlocks();
testDisposableEmail();
testGibberishName();
testMediumChallengeStandard();
testHighBlock();
testHumanVerificationAllowsMedium();
console.log("\nAll booking protection tests passed.");
