#!/usr/bin/env npx tsx
/**
 * Deterministic Voice V3 LiveKit ingress policy (no PSTN).
 */
import assert from "node:assert/strict";
import {
  buildVoiceV3IngressExecutionPlan,
  ingressPlanFromWizardTelephony,
} from "../src/lib/voice-v3/ingress/livekit-ingress-policy";
import type { RoutingDecision } from "../src/lib/voice/routing";

function routing(action: string, actions?: Record<string, unknown>): RoutingDecision {
  return {
    action,
    reason: "test",
    actions,
  };
}

// every_call → ai_answer immediate
const immediate = buildVoiceV3IngressExecutionPlan({
  routing: routing("ai_answer", { agentId: "a1" }),
  effectiveAction: "ai_answer",
  ringTeamSecondsFallback: 20,
});
assert.equal(immediate.mode, "immediate");
assert.equal(immediate.effectiveAction, "ai_answer");

// human_first → team ring then AI
const teamFirst = buildVoiceV3IngressExecutionPlan({
  routing: routing("human_first", { ringSeconds: 10, agentId: "a1" }),
  effectiveAction: "human_first",
  ringTeamSecondsFallback: 20,
});
assert.equal(teamFirst.mode, "after_team_ring");
assert.equal(teamFirst.ringSeconds, 10);

// ai_after_hours rule → human_first after resolveEffectiveRoutingAction (see routing-action-resolve.ts)
const afterHoursResolved = buildVoiceV3IngressExecutionPlan({
  routing: routing("ai_after_hours", { timezone: "America/New_York" }),
  effectiveAction: "human_first",
  ringTeamSecondsFallback: 12,
});
assert.equal(afterHoursResolved.mode, "after_team_ring");

const wizardNobody = ingressPlanFromWizardTelephony({
  answerWhen: "nobody_answers",
  ringBehavior: "ring_team_first",
  ringTeamSeconds: 15,
});
assert.equal(wizardNobody.mode, "after_team_ring");

const wizardEvery = ingressPlanFromWizardTelephony({
  answerWhen: "every_call",
  ringBehavior: "ai_immediate",
  ringTeamSeconds: 15,
});
assert.equal(wizardEvery.mode, "immediate");

console.log("VOICE_V3_LIVEKIT_INGRESS_POLICY=PASS");
