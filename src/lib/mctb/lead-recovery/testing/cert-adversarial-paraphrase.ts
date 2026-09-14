import type { Case } from "@/lib/mctb/lead-recovery/testing/cert-adversarial-types";

/** Hand-written paraphrases — same semantics, varied surface form (§38). */
export function appendParaphraseStressCases(cases: Case[], helpers: ParaphraseHelpers): void {
  let n = 0;
  const id = (cat: string) => {
    n += 1;
    return `adv-38-${cat}-${String(n).padStart(2, "0")}`;
  };

  const doNotCancelPhrases = [
    "Don't cancel it.",
    "Nah leave it alone.",
    "Keep it like it is.",
    "I changed my mind, don't touch it.",
    "Actually just leave the appointment.",
    "No, keep that one.",
    "dont cancel pls",
    "leave the appt as is",
  ];
  for (const body of doNotCancelPhrases) {
    const caseId = id("no-cancel");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertDoNotCancel(caseId, body),
    });
  }

  const cancelPaymentOnly = [
    "Don't cancel my appointment. Cancel the payment link.",
    "Keep the booking but cancel the pay link.",
    "Leave my appt alone — kill the payment request.",
    "Not the appointment, just cancel the deposit link.",
  ];
  for (const body of cancelPaymentOnly) {
    const caseId = id("cancel-pay-only");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertCancelPaymentNotBooking(caseId, body),
    });
  }

  const availNotBook = [
    "Anything tomorrow?",
    "got anything tmrw?",
    "what do u have tomorrow",
    "any openings tomorrow afternoon",
    "wondering if you have time tomorrow",
  ];
  for (const body of availNotBook) {
    const caseId = id("avail");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertAvailabilityNoCreate(caseId, body),
    });
  }

  const payQuestionNotRequest = [
    "How much would I have to pay?",
    "what's the cost gonna be",
    "how much u charge for a visit",
    "ballpark price?",
  ];
  for (const body of payQuestionNotRequest) {
    const caseId = id("pay-q");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertNotPaymentRequest(caseId, body),
    });
  }

  const callbackNotBook = [
    "Can someone call me?",
    "ring me back pls",
    "have somebody phone me",
    "i need a callback not an appointment",
  ];
  for (const body of callbackNotBook) {
    const caseId = id("callback");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertCallbackNoBookingCreate(caseId, body),
    });
  }

  const notOptOut = [
    "Don't stop texting me.",
    "dont stop msging me",
    "please don't stop contacting me about the appointment",
    "don't stop reaching out about my service",
  ];
  for (const body of notOptOut) {
    const caseId = id("not-optout");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertNotOptOut(caseId, body),
    });
  }

  const slotSecond = [
    "the second one",
    "2nd one",
    "middle one",
    "the 1 pm one",
  ];
  for (const body of slotSecond) {
    const caseId = id("slot");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertSlotMiddle(caseId, body),
    });
  }

  const typoNegation = [
    "nah dont cancel",
    "no dont cancel it",
    "pls keep appt",
  ];
  for (const body of typoNegation) {
    const caseId = id("typo-neg");
    cases.push({
      id: caseId,
      section: "38-PARAPHRASE",
      run: () => helpers.assertDoNotCancel(caseId, body),
    });
  }
}

export type ParaphraseHelpers = {
  assertDoNotCancel: (caseId: string, body: string) => Promise<void>;
  assertCancelPaymentNotBooking: (caseId: string, body: string) => Promise<void>;
  assertAvailabilityNoCreate: (caseId: string, body: string) => Promise<void>;
  assertNotPaymentRequest: (caseId: string, body: string) => Promise<void>;
  assertCallbackNoBookingCreate: (caseId: string, body: string) => Promise<void>;
  assertNotOptOut: (caseId: string, body: string) => Promise<void>;
  assertSlotMiddle: (caseId: string, body: string) => Promise<void>;
};
