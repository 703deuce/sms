/**
 * Appointment receptionist SolutionSetup linking checks (no DB required).
 * Run: npx tsx scripts/test-appointment-receptionist-setup.ts
 */

import assert from "assert";
import {
  outcomeSlugFromWizard,
  setupHrefForOutcome,
  SOLUTION_TYPE_CANONICAL,
} from "../src/lib/solutions/appointment-receptionist/save-setup";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";

assert.equal(SOLUTION_TYPE_CANONICAL, "appointment-receptionist");

assert.equal(
  outcomeSlugFromWizard({
    answerWhen: "every_call",
    capabilities: ["answer_questions", "take_messages"],
    preset: "every_call",
  }),
  "answer-every-call",
);
assert.equal(
  outcomeSlugFromWizard({
    answerWhen: "nobody_answers",
    capabilities: ["answer_questions", "book_appointments"],
    preset: "nobody_answers",
  }),
  "missed-overflow",
);
assert.equal(
  outcomeSlugFromWizard({
    answerWhen: "after_hours",
    capabilities: ["answer_questions", "book_appointments"],
  }),
  "after-hours",
);
assert.equal(
  outcomeSlugFromWizard({
    answerWhen: "every_call",
    capabilities: ["answer_questions", "book_appointments"],
  }),
  "appointment-booking",
);
assert.equal(
  outcomeSlugFromWizard({
    answerWhen: "every_call",
    capabilities: ["qualify_callers", "take_messages"],
    preset: "lead_capture",
  }),
  "lead-capture",
);

const href = setupHrefForOutcome("missed-overflow", "setup_1", "agent_1");
assert.ok(href.includes("setupId=setup_1"));
assert.ok(href.includes("agentId=agent_1"));
assert.ok(href.includes("preset=nobody_answers"));
assert.ok(href.includes("/solutions/ai-call-handling/appointment-assistant/setup"));

const defaults = createDefaultWizardState();
assert.ok(defaults.capabilities.includes("book_appointments"));
assert.ok(defaults.solutionName);

console.log("appointment-receptionist setup checks passed");
