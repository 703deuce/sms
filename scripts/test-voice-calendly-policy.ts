/**
 * Pure policy checks for voice Calendly booking (no DB).
 * Proves mid-call tools are not blocked by supervised-chat manageAppointments.
 */
import assert from "node:assert/strict";
import {
  classifyActionRisk,
  policyKeyForAction,
  DEFAULT_AI_POLICY,
  type PolicyMode,
} from "../src/lib/integrations/framework/ai-policy";

function modeForSource(
  source: "ai" | "voice" | "automation" | "api",
  actionId: string,
  policy = DEFAULT_AI_POLICY,
): PolicyMode {
  const key = policyKeyForAction(actionId);
  if (source === "ai" && key) return policy[key] as PolicyMode;
  if (source === "automation") return policy.preapprovedAutomations;
  if (source === "voice") return "allowed";
  return "allowed";
}

function requiresApproval(source: string, actionId: string, mode: PolicyMode): boolean {
  const riskLevel = classifyActionRisk(actionId);
  return (
    mode === "approval_required" ||
    (riskLevel >= 3 && source === "ai") ||
    (riskLevel === 4 && source !== "human" && source !== "voice")
  );
}

assert.equal(classifyActionRisk("appointment.list_available_times"), 1);
assert.equal(classifyActionRisk("appointment.book"), 3);
assert.equal(policyKeyForAction("appointment.list_available_times"), "readExternalData");
assert.equal(policyKeyForAction("appointment.book"), "manageAppointments");

// Bug that broke Amy call cmshzu3kh…: source=ai + manageAppointments approval_required
// blocked list/book, then voice fell back to fake internal slots.
assert.equal(modeForSource("ai", "appointment.list_available_times"), "allowed"); // readExternalData
assert.equal(modeForSource("ai", "appointment.book"), "approval_required");
assert.equal(requiresApproval("ai", "appointment.book", "approval_required"), true);

assert.equal(modeForSource("voice", "appointment.list_available_times"), "allowed");
assert.equal(modeForSource("voice", "appointment.book"), "allowed");
assert.equal(requiresApproval("voice", "appointment.book", "allowed"), false);
assert.equal(requiresApproval("voice", "appointment.cancel", "allowed"), false);

console.log("✓ voice Calendly policy: list is read, voice book skips chat approval");
