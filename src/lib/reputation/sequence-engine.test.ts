import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultReviewRequestSequence,
  evaluateConditionConfig,
  indexAfterSend,
  initialSendSteps,
  interpretSequenceStep,
  resolveWaveChannels,
  validateSequenceForLaunch,
  type RecipientFacts,
} from "./sequence-engine";

const baseFacts: RecipientFacts = {
  delivered: true,
  clicked: false,
  replied: false,
  optedOut: false,
  reviewDetected: false,
  hasPhone: true,
  hasEmail: true,
};

describe("sequence engine", () => {
  it("starts with a contiguous initial send step", () => {
    const steps = defaultReviewRequestSequence("sms");
    const initial = initialSendSteps(steps);
    assert.equal(initial.length, 1);
    assert.equal(initial[0]?.step_key, "initial");
    assert.equal(initial[0]?.step_type, "send_sms");
  });

  it("interprets wait then condition → reminder when no activity", () => {
    const steps = defaultReviewRequestSequence("sms");
    const waitIdx = steps.findIndex((s) => s.step_key === "wait_2d");
    const wait = interpretSequenceStep(steps, waitIdx, baseFacts, new Date("2026-07-01T12:00:00Z"));
    assert.equal(wait.action, "wait");
    if (wait.action === "wait") {
      assert.ok(wait.until.getTime() > Date.parse("2026-07-01T12:00:00Z"));
    }

    const gateIdx = steps.findIndex((s) => s.step_key === "reminder_1_gate");
    const gate = interpretSequenceStep(steps, gateIdx, baseFacts);
    assert.equal(gate.action, "jump");
    if (gate.action === "jump") assert.equal(gate.stepKey, "reminder_1");
  });

  it("ends sequence when customer already clicked", () => {
    const steps = defaultReviewRequestSequence("sms");
    const gateIdx = steps.findIndex((s) => s.step_key === "reminder_1_gate");
    const gate = interpretSequenceStep(steps, gateIdx, { ...baseFacts, clicked: true });
    assert.equal(gate.action, "jump");
    if (gate.action === "jump") assert.equal(gate.stepKey, "end");
  });

  it("stops immediately on opt-out", () => {
    const steps = defaultReviewRequestSequence("sms");
    const decision = interpretSequenceStep(steps, 0, { ...baseFacts, optedOut: true });
    assert.deepEqual(decision, { action: "stop", reason: "opted_out" });
  });

  it("evaluates negated condition tokens", () => {
    assert.equal(
      evaluateConditionConfig({ all: ["customer_opted_out:false"] }, baseFacts),
      true
    );
    assert.equal(
      evaluateConditionConfig({ all: ["customer_opted_out:false"] }, { ...baseFacts, optedOut: true }),
      false
    );
  });

  it("advances index after send", () => {
    const steps = defaultReviewRequestSequence("email");
    assert.equal(steps[0]?.step_type, "send_email");
    assert.equal(indexAfterSend(steps, 0), 1);
  });

  it("rejects too many send reminders", () => {
    const steps = [
      ...defaultReviewRequestSequence("sms"),
      { step_key: "extra1", step_type: "send_sms" as const, config: {} },
      { step_key: "extra2", step_type: "send_sms" as const, config: {} },
      { step_key: "extra3", step_type: "send_sms" as const, config: {} },
      { step_key: "extra4", step_type: "send_sms" as const, config: {} },
    ];
    // default has 3 sends; +4 = 7 > maxReminders(5)+1
    assert.ok(validateSequenceForLaunch(steps));
  });

  it("both plan sends SMS + email on each wave when contacts exist", () => {
    const steps = defaultReviewRequestSequence("both");
    const initial = steps[0]!;
    assert.deepEqual(
      resolveWaveChannels({
        campaignChannel: "both",
        step: initial,
        hasPhone: true,
        hasEmail: true,
      }),
      ["sms", "email"]
    );
    assert.deepEqual(
      resolveWaveChannels({
        campaignChannel: "both",
        step: initial,
        hasPhone: true,
        hasEmail: false,
      }),
      ["sms"]
    );
    assert.deepEqual(
      resolveWaveChannels({
        campaignChannel: "sms",
        step: initial,
        hasPhone: true,
        hasEmail: true,
      }),
      ["sms"]
    );
  });
});
