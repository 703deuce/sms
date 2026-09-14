import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { runSchedulingSpecialistAgent } from "@/lib/mctb/ai-booking/agents/scheduling-specialist";
import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { loadLeadRecoveryState, saveLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import {
  buildMctbSemanticConversationContext,
} from "@/lib/mctb/semantic-conversation-context";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
  LR_E2E_WORKSPACE_ID,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { getRecordingBookingLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { getRecordingPaymentLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";
import type { Case } from "@/lib/mctb/lead-recovery/testing/cert-adversarial-types";
import {
  appendParaphraseStressCases,
  type ParaphraseHelpers,
} from "@/lib/mctb/lead-recovery/testing/cert-adversarial-paraphrase";

export type AdversarialFailure = {
  caseId: string;
  section: string;
  customer: string;
  expected: string;
  actual: string;
  wrong: string;
};

export type AdversarialRunResult = {
  total: number;
  failed: number;
  failures: AdversarialFailure[];
  timestamp: string;
  paraphraseTotal: number;
  paraphraseFailed: number;
};

let phoneSeq = 6000;
function nextPhone() {
  phoneSeq += 1;
  return `+1555556${String(phoneSeq).padStart(4, "0")}`;
}

async function seedThread(
  conversationId: string,
  thread: Array<{ role: "customer" | "business"; text: string }>,
  patch?: Partial<Awaited<ReturnType<typeof loadLeadRecoveryState>>>,
) {
  const state = await loadLeadRecoveryState({
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
  });
  await saveLeadRecoveryState({ ...state, conversationThread: thread, ...patch });
}

async function intentFor(conversationId: string, message: string): Promise<StructuredLeadIntent> {
  return runLeadRecoveryIntentAgent({
    message,
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
  });
}

const OFFERED_SLOTS = [
  {
    slotId: "adv-10am",
    startUtc: "2026-09-14T14:00:00.000Z",
    endUtc: "2026-09-14T15:00:00.000Z",
    timezone: "America/New_York",
    label: "10 AM",
  },
  {
    slotId: "adv-1pm",
    startUtc: "2026-09-14T17:00:00.000Z",
    endUtc: "2026-09-14T18:00:00.000Z",
    timezone: "America/New_York",
    label: "1 PM",
  },
  {
    slotId: "adv-3pm",
    startUtc: "2026-09-14T19:00:00.000Z",
    endUtc: "2026-09-14T20:00:00.000Z",
    timezone: "America/New_York",
    label: "3 PM",
  },
];

function fail(
  caseId: string,
  section: string,
  customer: string,
  expected: string,
  actual: string,
  wrong: string,
): never {
  const err = new Error(wrong) as Error & { adv?: AdversarialFailure };
  err.adv = { caseId, section, customer, expected, actual, wrong };
  throw err;
}

function bookingCreates() {
  return getRecordingBookingLedger().filter((c) => c.kind === "create_booking").length;
}
function paymentCreates() {
  return getRecordingPaymentLedger().length;
}
function findSlots() {
  return getRecordingBookingLedger().filter((c) => c.kind === "find_slots").length;
}

function intentSummary(i: StructuredLeadIntent): string {
  return JSON.stringify({
    primary: i.primary_intent,
    booking_disposition: i.booking_disposition,
    booking_requested: i.booking_requested,
    payment_intent: i.payment_intent,
    needs_clarification: i.needs_clarification,
    workflow_updates: i.workflow_updates,
    callback_requested: i.callback_requested,
  });
}

async function slotSpec(message: string, conversationId: string) {
  const ctx = await buildMctbSemanticConversationContext({
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
    latestCustomerMessage: message,
  });
  return runSchedulingSpecialistAgent({
    message,
    timezone: "America/New_York",
    nowIso: "2026-09-13T12:00:00.000Z",
    offeredSlots: OFFERED_SLOTS,
    aiBookingSessionActive: true,
    sessionStage: "AWAITING_SLOT_SELECTION",
    semanticContext: ctx,
  });
}

function buildCases(): Case[] {
  const cases: Case[] = [];

  // §1 NEGATION + REVERSAL
  cases.push({
    id: "adv-1A",
    section: "1-NEGATION",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      const body = "I don't want to book anything right now, I just want to know what you have tomorrow.";
      const intent = await intentFor(conversationId, body);
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (bookingCreates() > 0) {
        fail("adv-1A", "1-NEGATION", body, "booking create=0", `creates=${bookingCreates()}`, "created booking");
      }
      if (intent.primary_intent === "BOOKING_REQUEST" && intent.booking_disposition === "REQUEST_BOOKING") {
        fail(
          "adv-1A",
          "1-NEGATION",
          body,
          "CHECK_AVAILABILITY / availability read",
          intentSummary(intent),
          "classified as REQUEST_BOOKING not availability read",
        );
      }
    },
  });

  cases.push({
    id: "adv-1C",
    section: "1-NEGATION",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [{ role: "business", text: "Should I cancel the appointment?" }], {
        pendingAction: { action: "AI_BOOK", epoch: 1 },
      });
      const body = "Don't cancel it.";
      const intent = await intentFor(conversationId, body);
      const cancel = intent.workflow_updates?.some(
        (w) => w.instruction === "CANCEL" && (w.target === "ALL_PENDING" || w.target === "PENDING_BOOKING"),
      );
      if (cancel || intent.primary_intent === "CANCEL_REQUEST") {
        fail("adv-1C", "1-NEGATION", body, "KEEP booking", intentSummary(intent), "treated as cancel");
      }
    },
  });

  cases.push({
    id: "adv-1E",
    section: "1-NEGATION",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [{ role: "business", text: "Should I cancel your pending booking?" }]);
      const body = "Never mind — actually yeah, book it.";
      const intent = await intentFor(conversationId, body);
      const keepOnly = intent.workflow_updates?.every((w) => w.instruction === "KEEP");
      if (keepOnly && intent.booking_disposition !== "CONFIRM_BOOKING" && !intent.booking_requested) {
        fail("adv-1E", "1-NEGATION", body, "final meaning book", intentSummary(intent), "still KEEP only");
      }
    },
  });

  // §2 WRONG INTENT SHAPE
  cases.push({
    id: "adv-2A",
    section: "2-WRONG-INTENT",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      const body = "Do you take payments over the phone?";
      const intent = await intentFor(conversationId, body);
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (intent.payment_intent && intent.primary_intent === "PAYMENT_REQUEST") {
        fail("adv-2A", "2-WRONG-INTENT", body, "FAQ not PAYMENT_REQUEST", intentSummary(intent), "payment request intent");
      }
      if (paymentCreates() > 0) {
        fail("adv-2A", "2-WRONG-INTENT", body, "no payment create", `payments=${paymentCreates()}`, "payment created");
      }
    },
  });

  cases.push({
    id: "adv-2E",
    section: "2-WRONG-INTENT",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      const body = "I don't need to book anything. Can someone call me?";
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (bookingCreates() > 0) {
        fail("adv-2E", "2-WRONG-INTENT", body, "callback only", `creates=${bookingCreates()}`, "booking create");
      }
    },
  });

  // §3 AVAILABILITY VS BOOKING
  for (const [id, body, expectAvail, noCreate] of [
    ["adv-3A", "Anything tomorrow?", true, true],
    ["adv-3B", "Anything tomorrow afternoon?", true, true],
    ["adv-3E", "Do you have 3 tomorrow?", true, true],
  ] as const) {
    cases.push({
      id,
      section: "3-AVAILABILITY",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eAiBookingPolicy();
        const phone = nextPhone();
        const { conversationId, contactId } = await createE2eConversation(phone);
        const intent = await intentFor(conversationId, body);
        await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
        if (noCreate && bookingCreates() > 0) {
          fail(id, "3-AVAILABILITY", body, "no booking create", `creates=${bookingCreates()}`, "unexpected create");
        }
        if (expectAvail && findSlots() < 1 && intent.primary_intent !== "BUSINESS_HOURS") {
          fail(id, "3-AVAILABILITY", body, "availability read>=1", `finds=${findSlots()} intent=${intentSummary(intent)}`, "no calendar read");
        }
      },
    });
  }

  cases.push({
    id: "adv-3D",
    section: "3-AVAILABILITY",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const body = "Are you guys open tomorrow?";
      const intent = await intentFor(conversationId, body);
      if (intent.primary_intent === "AVAILABILITY_QUESTION" && intent.booking_disposition === "CHECK_AVAILABILITY") {
        fail("adv-3D", "3-AVAILABILITY", body, "BUSINESS_HOURS", intentSummary(intent), "treated as slot availability");
      }
    },
  });

  // §4 SLOT TORTURE (scheduling specialist)
  const slotExpect: Array<[string, string, string | "clarify", number | null]> = [
    ["adv-4A", "the middle one", "adv-1pm", 2],
    ["adv-4B", "the last one", "adv-3pm", 3],
    ["adv-4C", "the earliest", "adv-10am", 1],
    ["adv-4D", "the latest", "adv-3pm", 3],
    ["adv-4E", "not 1, the one after that", "adv-3pm", 3],
    ["adv-4I", "3 pm", "adv-3pm", 3],
    ["adv-4J", "number 3", "adv-3pm", 3],
  ];
  for (const [id, msg, slotId, idx] of slotExpect) {
    cases.push({
      id,
      section: "4-SLOTS",
      run: async () => {
        resetE2eRecordingState();
        const phone = nextPhone();
        const { conversationId } = await createE2eConversation(phone);
        await seedThread(conversationId, [
          { role: "business", text: "Tomorrow I have 10 AM, 1 PM, or 3 PM." },
        ]);
        const spec = await slotSpec(msg, conversationId);
        const ok =
          spec.offered_slot_id === slotId ||
          (idx != null && spec.offered_slot_index === idx);
        if (!ok) {
          fail(
            id,
            "4-SLOTS",
            msg,
            `slot ${slotId} or index ${idx}`,
            JSON.stringify({
              action: spec.action,
              offered_slot_id: spec.offered_slot_id,
              offered_slot_index: spec.offered_slot_index,
            }),
            "wrong slot resolution",
          );
        }
      },
    });
  }

  cases.push({
    id: "adv-4F",
    section: "4-SLOTS",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [{ role: "business", text: "Tomorrow I have 10 AM, 1 PM, or 3 PM." }]);
      const msg = "not the first one";
      const spec = await slotSpec(msg, conversationId);
      if (
        spec.action !== "ASK_CLARIFICATION" &&
        !spec.needs_clarification &&
        spec.offered_slot_index !== 2 &&
        spec.offered_slot_index !== 3
      ) {
        fail("adv-4F", "4-SLOTS", msg, "clarify or 1pm/3pm", JSON.stringify(spec), "random slot guess");
      }
    },
  });

  // §5 SHORT REPLY
  cases.push({
    id: "adv-5E",
    section: "5-SHORT-REPLY",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [{ role: "business", text: "Do you want me to cancel it?" }], {
        pendingAction: { action: "AI_BOOK", epoch: 1 },
      });
      const intent = await intentFor(conversationId, "no");
      const cancelWf = intent.workflow_updates?.some(
        (w) => w.instruction === "CANCEL" && (w.target === "PENDING_BOOKING" || w.target === "ALL_PENDING"),
      );
      if (
        cancelWf ||
        (intent.primary_intent === "CANCEL_REQUEST" &&
          !intent.workflow_updates?.some((w) => w.instruction === "KEEP"))
      ) {
        fail("adv-5E", "5-SHORT-REPLY", "no", "do not cancel", intentSummary(intent), "cancel on no");
      }
    },
  });

  // §8 AMBIGUITY
  cases.push({
    id: "adv-8A",
    section: "8-AMBIGUITY",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, "Can you do that?");
      if (!intent.needs_clarification && intent.confidence > 0.7 && intent.primary_intent !== "UNKNOWN") {
        fail("adv-8A", "8-AMBIGUITY", "Can you do that?", "clarification", intentSummary(intent), "guessed intent");
      }
    },
  });

  // §18 OPT-OUT
  cases.push({
    id: "adv-18D",
    section: "18-OPT-OUT",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, "Don't stop texting me.");
      if (intent.primary_intent === "OPT_OUT") {
        fail("adv-18D", "18-OPT-OUT", "Don't stop texting me.", "NOT opt-out", intentSummary(intent), "false opt-out");
      }
    },
  });

  cases.push({
    id: "adv-18A",
    section: "18-OPT-OUT",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, "Stop texting me.");
      if (intent.primary_intent !== "OPT_OUT") {
        fail("adv-18A", "18-OPT-OUT", "Stop texting me.", "OPT_OUT", intentSummary(intent), "missed opt-out");
      }
    },
  });

  // §30 SARCASM
  cases.push({
    id: "adv-30A",
    section: "30-SARCASM",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, "Yeah, great, another no-show.");
      if (intent.primary_intent === "BOOKING_REQUEST" || intent.booking_disposition === "CONFIRM_BOOKING") {
        fail("adv-30A", "30-SARCASM", "Yeah, great, another no-show.", "complaint", intentSummary(intent), "affirmation");
      }
    },
  });

  cases.push({
    id: "adv-30B",
    section: "30-SARCASM",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      await runLeadRecoveryCustomerTurn({
        conversationId,
        contactId,
        customerPhone: phone,
        body: "Can somebody come tomorrow?",
      });
      const body = "Sure, because 3 PM worked so well last time.";
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (bookingCreates() > 0) {
        fail("adv-30B", "30-SARCASM", body, "no blind 3pm book", `creates=${bookingCreates()}`, "booked from sarcasm");
      }
    },
  });

  // §28 TYPO
  cases.push({
    id: "adv-28A",
    section: "28-TYPO",
    run: async () => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      const body = "need sum1 tmrw afta 2";
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (findSlots() < 1 && bookingCreates() < 1) {
        fail("adv-28A", "28-TYPO", body, "scheduling engaged", `finds=${findSlots()}`, "no response path");
      }
    },
  });

  const helpers: ParaphraseHelpers = {
    assertDoNotCancel: async (caseId, body) => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [{ role: "business", text: "Should I cancel the appointment?" }], {
        pendingAction: { action: "AI_BOOK", epoch: 1 },
      });
      const intent = await intentFor(conversationId, body);
      const cancelWf = intent.workflow_updates?.some(
        (w) => w.instruction === "CANCEL" && (w.target === "PENDING_BOOKING" || w.target === "ALL_PENDING"),
      );
      if (cancelWf || (intent.primary_intent === "CANCEL_REQUEST" && !intent.workflow_updates?.some((w) => w.instruction === "KEEP"))) {
        fail(caseId, "38-PARAPHRASE", body, "KEEP booking", intentSummary(intent), "treated as cancel");
      }
    },
    assertCancelPaymentNotBooking: async (caseId, body) => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [], {
        pendingAction: { action: "AI_BOOK", epoch: 1 },
      });
      const intent = await intentFor(conversationId, body);
      const cancelBook = intent.workflow_updates?.some(
        (w) => w.instruction === "CANCEL" && (w.target === "PENDING_BOOKING" || w.target === "ALL_PENDING"),
      );
      if (cancelBook) {
        fail(caseId, "38-PARAPHRASE", body, "cancel payment only", intentSummary(intent), "cancelled booking");
      }
    },
    assertAvailabilityNoCreate: async (caseId, body) => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (bookingCreates() > 0) {
        fail(caseId, "38-PARAPHRASE", body, "no booking create", `creates=${bookingCreates()}`, "unauthorized create");
      }
    },
    assertNotPaymentRequest: async (caseId, body) => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, body);
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (intent.primary_intent === "PAYMENT_REQUEST" && paymentCreates() > 0) {
        fail(caseId, "38-PARAPHRASE", body, "pricing question", intentSummary(intent), "payment request");
      }
    },
    assertCallbackNoBookingCreate: async (caseId, body) => {
      resetE2eRecordingState();
      await configureE2eAiBookingPolicy();
      const phone = nextPhone();
      const { conversationId, contactId } = await createE2eConversation(phone);
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (bookingCreates() > 0) {
        fail(caseId, "38-PARAPHRASE", body, "callback no book", `creates=${bookingCreates()}`, "booking create");
      }
    },
    assertNotOptOut: async (caseId, body) => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, body);
      if (intent.primary_intent === "OPT_OUT") {
        fail(caseId, "38-PARAPHRASE", body, "NOT opt-out", intentSummary(intent), "false opt-out");
      }
    },
    assertSlotMiddle: async (caseId, body) => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [{ role: "business", text: "Tomorrow I have 10 AM, 1 PM, or 3 PM." }]);
      const spec = await slotSpec(body, conversationId);
      const ok = spec.offered_slot_id === "adv-1pm" || spec.offered_slot_index === 2;
      if (!ok) {
        fail(
          caseId,
          "38-PARAPHRASE",
          body,
          "1 PM / index 2",
          JSON.stringify({ id: spec.offered_slot_id, idx: spec.offered_slot_index, action: spec.action }),
          "slot drift",
        );
      }
    },
  };
  appendParaphraseStressCases(cases, helpers);

  return cases;
}

export async function runAdversarialCertificationOnce(): Promise<AdversarialRunResult> {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";
  process.env.LR_CERT_E2E_NOW = "2026-09-13T12:00:00.000Z";
  const { setMctbAiBookingSessionStore, inMemoryMctbAiBookingSessionStore } = await import(
    "@/lib/mctb/ai-booking/session-store"
  );
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  await configureE2eAiBookingPolicy();

  const cases = buildCases();
  const failures: AdversarialFailure[] = [];
  let paraphraseTotal = 0;
  let paraphraseFailed = 0;
  for (const c of cases) {
    if (c.section === "38-PARAPHRASE") paraphraseTotal++;
    try {
      await c.run();
    } catch (e) {
      const err = e as Error & { adv?: AdversarialFailure };
      if (c.section === "38-PARAPHRASE") paraphraseFailed++;
      if (err.adv) failures.push(err.adv);
      else {
        failures.push({
          caseId: c.id,
          section: c.section,
          customer: "(see wrong)",
          expected: "pass",
          actual: err.message,
          wrong: err.message,
        });
      }
    }
  }
  return {
    total: cases.length,
    failed: failures.length,
    failures,
    timestamp: new Date().toISOString(),
    paraphraseTotal,
    paraphraseFailed,
  };
}

export function formatAdversarialFailuresOnly(result: AdversarialRunResult): string {
  if (result.failures.length === 0) {
    return [
      "MCTB AI LEAD RECOVERY — ADVERSARIAL CERT (FAILURES ONLY)",
      `Run: ${result.timestamp} (single pass)`,
      `Cases executed: ${result.total}`,
      "FAILED: 0",
      "",
      "(No failures — adversarial batch passed all executed cases.)",
    ].join("\n");
  }
  const lines = [
    "MCTB AI LEAD RECOVERY — ADVERSARIAL CERT (FAILURES ONLY)",
    `Run: ${result.timestamp} (single pass)`,
    `Cases executed: ${result.total}`,
    `FAILED: ${result.failed}`,
    `PARAPHRASE_SCENARIOS: ${result.paraphraseTotal}`,
    `PARAPHRASE_FAILURES: ${result.paraphraseFailed}`,
    `SEMANTIC_DRIFT_FAILURES: ${result.paraphraseFailed}`,
    "",
  ];
  for (const f of result.failures) {
    lines.push(`--- ${f.caseId} (${f.section}) ---`);
    lines.push(`Customer: ${f.customer}`);
    lines.push(`Expected: ${f.expected}`);
    lines.push(`Actual: ${f.actual}`);
    lines.push(`Wrong: ${f.wrong}`);
    lines.push("");
  }
  return lines.join("\n");
}
