import assert from "node:assert/strict";
import {
  agentTypeFromOutcomeSlug,
  getAgentType,
  outcomeSlugFromAgentType,
} from "../src/lib/agents/types";
import { outcomeSlugFromSetup } from "../src/lib/outcomes/instances";
import { outcomeSlugFromWizard } from "../src/lib/solutions/appointment-receptionist/save-setup";

assert.equal(
  outcomeSlugFromWizard({
    answerWhen: "every_call",
    capabilities: ["book_appointments", "answer_questions"],
  }),
  "appointment-booking",
);

assert.equal(
  outcomeSlugFromWizard({
    preset: "every_call",
    answerWhen: "every_call",
    capabilities: ["answer_questions", "take_messages"],
  }),
  "answer-every-call",
);

assert.equal(
  outcomeSlugFromWizard({
    preset: "lead_capture",
    answerWhen: "every_call",
    capabilities: ["qualify_callers"],
  }),
  "lead-capture",
);

assert.equal(
  outcomeSlugFromSetup({
    solutionType: "appointment-receptionist",
    configJson: { outcomeSlug: "appointment-booking" },
  }),
  "appointment-booking",
);

assert.equal(
  outcomeSlugFromSetup({
    solutionType: "missed-call-text-back",
    configJson: {},
  }),
  "missed-call-text-back",
);

assert.equal(agentTypeFromOutcomeSlug("appointment-booking"), "appointment_booking");
assert.equal(agentTypeFromOutcomeSlug("answer-every-call"), "answer_every_call");
assert.equal(
  agentTypeFromOutcomeSlug("missed-call-text-back"),
  "missed_call_text_back",
);
assert.equal(outcomeSlugFromAgentType("appointment_booking"), "appointment-booking");
assert.equal(getAgentType("lead_capture").label, "Inquiry Capture Agent");
assert.equal(getAgentType("appointment_booking").family, "receptionist");

console.log("outcome ownership checks passed");
