import assert from "node:assert/strict";
import { outcomeSlugFromWizard } from "../src/lib/solutions/appointment-receptionist/save-setup";
import { outcomeSlugFromSetup } from "../src/lib/outcomes/instances";

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

console.log("outcome ownership checks passed");
