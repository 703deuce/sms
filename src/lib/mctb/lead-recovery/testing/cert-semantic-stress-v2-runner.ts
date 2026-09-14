import { runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { loadLeadRecoveryState, saveLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import { buildMctbSemanticConversationContext } from "@/lib/mctb/semantic-conversation-context";
import {
  configureE2eAiBookingPolicy,
  createE2eConversation,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
  LR_E2E_WORKSPACE_ID,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { getRecordingBookingLedger } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";
import type { AdversarialFailure } from "@/lib/mctb/lead-recovery/testing/cert-adversarial-runner";

type Case = { id: string; section: string; category: string; run: () => Promise<void> };

let phoneSeq = 7000;
const nextPhone = () => `+1555557${String(++phoneSeq).padStart(4, "0")}`;

function fail(f: AdversarialFailure): never {
  throw Object.assign(new Error(f.wrong), { adv: f });
}

function intentSummary(i: StructuredLeadIntent): string {
  return JSON.stringify({
    primary: i.primary_intent,
    stop_scope: i.stop_scope,
    booking_disposition: i.booking_disposition,
    workflow_updates: i.workflow_updates,
    needs_clarification: i.needs_clarification,
  });
}

async function intentFor(conversationId: string, message: string) {
  return runLeadRecoveryIntentAgent({
    message,
    workspaceId: LR_E2E_WORKSPACE_ID,
    conversationId,
  });
}

async function seedThread(
  conversationId: string,
  thread: Array<{ role: "customer" | "business"; text: string }>,
  patch?: Partial<Awaited<ReturnType<typeof loadLeadRecoveryState>>>,
) {
  const state = await loadLeadRecoveryState({ workspaceId: LR_E2E_WORKSPACE_ID, conversationId });
  await saveLeadRecoveryState({ ...state, conversationThread: thread, ...patch });
}

function bookingCreates() {
  return getRecordingBookingLedger().filter((c) => c.kind === "create_booking").length;
}

function repeatCase(base: Case, times: number): Case[] {
  if (times <= 1) return [base];
  return Array.from({ length: times }, (_, i) => ({
    ...base,
    id: `${base.id}-r${i + 1}`,
    run: base.run,
  }));
}

function buildStressV2Cases(highRiskRepeats: number): Case[] {
  const cases: Case[] = [];

  const expectNotOptOut = (id: string, body: string, ctx?: Array<{ role: "customer" | "business"; text: string }>) =>
    cases.push({
      id,
      section: "V2-1-OPT-OUT-NEG",
      category: "FALSE_OPT_OUT",
      run: async () => {
        const phone = nextPhone();
        const { conversationId } = await createE2eConversation(phone);
        if (ctx) await seedThread(conversationId, ctx);
        const intent = await intentFor(conversationId, body);
        if (intent.primary_intent === "OPT_OUT") {
          fail({
            caseId: id,
            section: "V2-1-OPT-OUT-NEG",
            customer: body,
            expected: "NOT OPT_OUT",
            actual: intentSummary(intent),
            wrong: "FALSE_OPT_OUT",
          });
        }
      },
    });

  const expectOptOut = (id: string, body: string) =>
    cases.push({
      id,
      section: "V2-1-OPT-OUT-NEG",
      category: "MISSED_OPT_OUT",
      run: async () => {
        const phone = nextPhone();
        const { conversationId } = await createE2eConversation(phone);
        const intent = await intentFor(conversationId, body);
        if (intent.primary_intent !== "OPT_OUT") {
          fail({
            caseId: id,
            section: "V2-1-OPT-OUT-NEG",
            customer: body,
            expected: "OPT_OUT",
            actual: intentSummary(intent),
            wrong: "MISSED_OPT_OUT",
          });
        }
      },
    });

  const optOutPairs: Array<{ id: string; body: string; optOut: boolean }> = [
    { id: "v2-1A", body: "Stop texting me.", optOut: true },
    { id: "v2-1B", body: "Don't stop texting me.", optOut: false },
    { id: "v2-1C", body: "Please stop messaging me.", optOut: true },
    { id: "v2-1D", body: "Please don't stop messaging me.", optOut: false },
    { id: "v2-1E", body: "Quit contacting me.", optOut: true },
    { id: "v2-1F", body: "Don't quit contacting me.", optOut: false },
    { id: "v2-1G", body: "Leave me alone.", optOut: true },
    { id: "v2-1H", body: "Don't leave me alone, keep me updated.", optOut: false },
  ];
  for (const p of optOutPairs) {
    const base: Case = {
      id: p.id,
      section: "V2-1-OPT-OUT-NEG",
      category: p.optOut ? "MISSED_OPT_OUT" : "FALSE_OPT_OUT",
      run: async () => {
        const phone = nextPhone();
        const { conversationId } = await createE2eConversation(phone);
        const intent = await intentFor(conversationId, p.body);
        if (p.optOut && intent.primary_intent !== "OPT_OUT") {
          fail({
            caseId: p.id,
            section: "V2-1-OPT-OUT-NEG",
            customer: p.body,
            expected: "OPT_OUT",
            actual: intentSummary(intent),
            wrong: "MISSED_OPT_OUT",
          });
        }
        if (!p.optOut && intent.primary_intent === "OPT_OUT") {
          fail({
            caseId: p.id,
            section: "V2-1-OPT-OUT-NEG",
            customer: p.body,
            expected: "NOT OPT_OUT",
            actual: intentSummary(intent),
            wrong: "FALSE_OPT_OUT",
          });
        }
      },
    };
    cases.push(...repeatCase(base, highRiskRepeats));
  }

  // §23 messy STT opt-out pair
  for (const [id, body, optOut] of [
    ["v2-23A", "dont stp txtn me", false],
    ["v2-23B", "stp txtn me", true],
    ["v2-23C", "nah dnt cancel it", false],
  ] as const) {
    const base: Case = {
      id,
      section: "V2-23-STT",
      category: optOut ? "MISSED_OPT_OUT" : "NEGATION_SCOPE",
      run: async () => {
        const phone = nextPhone();
        const { conversationId } = await createE2eConversation(phone);
        if (id === "v2-23C") {
          await seedThread(conversationId, [{ role: "business", text: "Should I cancel the appointment?" }]);
        }
        const intent = await intentFor(conversationId, body);
        if (!optOut && intent.primary_intent === "OPT_OUT") {
          fail({
            caseId: id,
            section: "V2-23-STT",
            customer: body,
            expected: "NOT OPT_OUT / KEEP",
            actual: intentSummary(intent),
            wrong: "FALSE_OPT_OUT",
          });
        }
        if (optOut && intent.primary_intent !== "OPT_OUT") {
          fail({
            caseId: id,
            section: "V2-23-STT",
            customer: body,
            expected: "OPT_OUT",
            actual: intentSummary(intent),
            wrong: "MISSED_OPT_OUT",
          });
        }
        if (id === "v2-23C") {
          const cancel = intent.workflow_updates?.some((w) => w.instruction === "CANCEL");
          if (cancel || intent.primary_intent === "CANCEL_REQUEST") {
            fail({
              caseId: id,
              section: "V2-23-STT",
              customer: body,
              expected: "KEEP",
              actual: intentSummary(intent),
              wrong: "FALSE_CANCELLATION",
            });
          }
        }
      },
    };
    cases.push(...repeatCase(base, id.startsWith("v2-23A") || id.startsWith("v2-23B") ? highRiskRepeats : 1));
  }

  // §3 context "I said stop"
  cases.push({
    id: "v2-3-ctx1",
    section: "V2-3-CONTEXT",
    category: "CONTEXT_SCOPE",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(
        conversationId,
        [{ role: "business", text: "Should I keep looking for appointments?" }],
        {
          activeSpecialist: "SCHEDULING",
          pendingAction: { action: "AI_BOOK", epoch: 1 },
        },
      );
      const intent = await intentFor(conversationId, "Stop.");
      if (intent.primary_intent === "OPT_OUT") {
        fail({
          caseId: "v2-3-ctx1",
          section: "V2-3-CONTEXT",
          customer: "Stop.",
          expected: "stop search not global opt-out",
          actual: intentSummary(intent),
          wrong: "CONTEXT_SCOPE_FAILURE",
        });
      }
    },
  });

  cases.push({
    id: "v2-3-ctx2",
    section: "V2-3-CONTEXT",
    category: "MISSED_OPT_OUT",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      await seedThread(conversationId, [
        { role: "customer", text: "Stop texting me." },
        { role: "business", text: "Sorry — how can we help?" },
      ]);
      const intent = await intentFor(conversationId, "I said stop.");
      if (intent.primary_intent !== "OPT_OUT") {
        fail({
          caseId: "v2-3-ctx2",
          section: "V2-3-CONTEXT",
          customer: "I said stop.",
          expected: "OPT_OUT",
          actual: intentSummary(intent),
          wrong: "MISSED_OPT_OUT",
        });
      }
    },
  });

  // §17 sarcasm E2E
  cases.push({
    id: "v2-17D",
    section: "V2-17-SARCASM",
    category: "FALSE_BOOKING",
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
      const body = "3 PM worked out great last time.";
      await runLeadRecoveryCustomerTurn({ conversationId, contactId, customerPhone: phone, body });
      if (bookingCreates() > 0) {
        fail({
          caseId: "v2-17D",
          section: "V2-17-SARCASM",
          customer: body,
          expected: "no create from historical statement",
          actual: `creates=${bookingCreates()}`,
          wrong: "FALSE_BOOKING",
        });
      }
    },
  });

  // §25 quoted NOT opt-out
  expectNotOptOut("v2-25A", "You said 'stop texting me' is what I should reply if I want out. I'm not saying that.");

  // §26 meta
  cases.push({
    id: "v2-26A",
    section: "V2-26-META",
    category: "FALSE_OPT_OUT",
    run: async () => {
      const phone = nextPhone();
      const { conversationId } = await createE2eConversation(phone);
      const intent = await intentFor(conversationId, "What happens if I say stop?");
      if (intent.primary_intent === "OPT_OUT") {
        fail({
          caseId: "v2-26A",
          section: "V2-26-META",
          customer: "What happens if I say stop?",
          expected: "FAQ not opt-out",
          actual: intentSummary(intent),
          wrong: "FALSE_OPT_OUT",
        });
      }
    },
  });

  return cases;
}

export type StressV2Result = {
  passes: number;
  total: number;
  failures: AdversarialFailure[];
  timestamp: string;
  runPass: number;
  scores: Record<string, number>;
};

export async function runSemanticStressV2(input?: {
  suitePasses?: number;
  highRiskRepeats?: number;
}): Promise<StressV2Result[]> {
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

  const suitePasses = input?.suitePasses ?? 2;
  const highRiskRepeats = input?.highRiskRepeats ?? 10;
  const results: StressV2Result[] = [];

  for (let runPass = 1; runPass <= suitePasses; runPass++) {
    phoneSeq = 7000 + runPass * 10000;
    const cases = buildStressV2Cases(highRiskRepeats);
    const failures: AdversarialFailure[] = [];
    const scores: Record<string, number> = {};
    let passed = 0;
    for (const c of cases) {
      try {
        await c.run();
        passed++;
      } catch (e) {
        const err = e as Error & { adv?: AdversarialFailure };
        const f =
          err.adv ??
          ({
            caseId: c.id,
            section: c.section,
            customer: "",
            expected: "pass",
            actual: err.message,
            wrong: err.message,
          } as AdversarialFailure);
        failures.push(f);
        const cat = c.category || "OTHER";
        scores[cat] = (scores[cat] || 0) + 1;
      }
    }
    results.push({
      passes: passed,
      total: cases.length,
      failures,
      timestamp: new Date().toISOString(),
      runPass,
      scores,
    });
  }
  return results;
}

export function formatStressV2FailuresOnly(results: StressV2Result[]): string {
  const allFails = results.flatMap((r) =>
    r.failures.map((f) => ({ ...f, runPass: r.runPass })),
  );
  const unique = new Map<string, (typeof allFails)[0]>();
  for (const f of allFails) {
    const key = `${f.caseId.replace(/-r\d+$/, "")}|${f.customer}|${f.wrong}`;
    if (!unique.has(key)) unique.set(key, f);
  }
  const lines = [
    "SEMANTIC STRESS TEST V2 — FAILURES ONLY",
    `Suite passes: ${results.length}`,
    `Total model runs (last pass): ${results.at(-1)?.total ?? 0}`,
    `Unique failure patterns: ${unique.size}`,
    "",
  ];
  if (unique.size === 0) {
    lines.push("(No failures across runs.)");
    return lines.join("\n");
  }
  for (const f of unique.values()) {
    lines.push(`--- ${f.caseId} (pass ${f.runPass}) ${f.section} ---`);
    lines.push(`Customer: ${f.customer}`);
    lines.push(`Expected: ${f.expected}`);
    lines.push(`Actual: ${f.actual}`);
    lines.push(`Wrong: ${f.wrong}`);
    lines.push("");
  }
  return lines.join("\n");
}
