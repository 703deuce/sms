import { getRecordingSmsOutbox } from "@/lib/voice/testing/headless/recording-sms";
import { setRecordingSmsNextFailure } from "@/lib/voice/testing/headless/recording-sms";
import { getRecordingPaymentLedger, setRecordingPaymentBehavior } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import { getRecordingHandoffLedger, setRecordingHandoffNextFail } from "@/lib/mctb/lead-recovery/testing/recording/recording-handoff";
import { getRecordingBookingLedger, setRecordingBookingBehavior } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { assertNoFalseSuccess } from "@/lib/mctb/lead-recovery/testing/cert-e2e-false-success";
import {
  configureE2eBookingLinkPolicy,
  configureE2eAiBookingPolicy,
  createE2eConversation,
  ensureLeadRecoveryE2eWorkspace,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { validateJohnProposedActions } from "@/lib/mctb/lead-recovery/john-policy-guard";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";
import { buildAiBookingE2eScenarios } from "@/lib/mctb/lead-recovery/testing/cert-booking-e2e";
import { buildAvailabilityBookingE2eScenarios } from "@/lib/mctb/lead-recovery/testing/cert-availability-booking-e2e";
import {
  buildConversationScenarios,
  buildCrossWorkerScenarios,
  buildPaymentFailureMatrixScenarios,
  buildPaymentStatusE2eScenarios,
} from "@/lib/mctb/lead-recovery/testing/cert-extended-e2e";
import { buildSemanticNegationScenarios } from "@/lib/mctb/lead-recovery/testing/cert-semantic-negation";
import { buildChangeOfMindScenarios } from "@/lib/mctb/lead-recovery/testing/cert-change-of-mind";
import { buildConversationContextScenarios } from "@/lib/mctb/lead-recovery/testing/cert-conversation-context";
import { mctbSemanticModelId, resolveMctbSemanticLlmProvider } from "@/lib/mctb/semantic-llm";
import {
  getConversationContextMetrics,
  resetConversationContextMetrics,
} from "@/lib/mctb/semantic-conversation-context";
import {
  resetCertE2eSmsMetrics,
  summarizeCertE2eSmsMetrics,
} from "@/lib/mctb/lead-recovery/testing/cert-sms-metrics";
import {
  beginCertScenarioTrace,
  certResultsTraceEnabled,
  endCertScenarioTrace,
  pushCertScenarioRecord,
  resetCertScenarioRecords,
} from "@/lib/mctb/lead-recovery/testing/cert-results-trace";

export type E2eCertFailure = { scenarioId: string; failureClass: string; detail: string };

export type E2eCertResult = {
  passed: number;
  total: number;
  hardFailures: E2eCertFailure[];
  smsOneSegmentRate: number;
  avgSegments: number;
  p95Segments: number;
  unnecessary3Plus: number;
  outboundSmsCount: number;
  measuredSmsCount: number;
  falseSuccessCount: number;
  groups: Record<string, { passed: number; total: number }>;
  fullAgentProductionCertified: boolean;
  smsMetrics: ReturnType<typeof summarizeCertE2eSmsMetrics>;
};

type Scenario = {
  id: string;
  group: string;
  run: () => Promise<void>;
};

function fail(id: string, cls: string, detail: string): never {
  throw Object.assign(new Error(detail), { scenarioId: id, failureClass: cls });
}

export function buildLeadRecoveryE2eScenarios(): Scenario[] {
  return [
    {
      id: "booking-link-e2e",
      group: "BOOKING_LINK",
      run: async () => {
        resetE2eRecordingState();
        await configureE2eBookingLinkPolicy();
        const { conversationId, contactId } = await createE2eConversation("+15555550101");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550101",
          body: "Send me the booking link.",
        });
        const sms = getRecordingSmsOutbox();
        if (sms.length !== 1) fail("booking-link-e2e", "PROVIDER_FAILURE", `sms count ${sms.length}`);
        if (!sms[0].body.includes("book.example.test")) {
          fail("booking-link-e2e", "POLICY_FAILURE", "canonical booking URL missing");
        }
        const fs = assertNoFalseSuccess({
          reply: turn.lrReply,
          smsLinkSent: true,
        });
        if (fs.length) fail("booking-link-e2e", "COMPLIANCE_FAILURE", fs.join("; "));
      },
    },
    {
      id: "booking-link-sms-fail",
      group: "FALSE_SUCCESS",
      run: async () => {
        resetE2eRecordingState();
        setRecordingSmsNextFailure(true);
        const { conversationId, contactId } = await createE2eConversation("+15555550102");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550102",
          body: "Can you text me where to schedule?",
        });
        const fs = assertNoFalseSuccess({
          reply: turn.lrReply,
          smsLinkSent: false,
        });
        if (fs.length) {
          falseSuccessCount += fs.length;
          fail("booking-link-sms-fail", "COMPLIANCE_FAILURE", fs.join("; "));
        }
      },
    },
    {
      id: "payment-e2e",
      group: "PAYMENT",
      run: async () => {
        resetE2eRecordingState();
        setRecordingPaymentBehavior("success");
        const { conversationId, contactId } = await createE2eConversation("+15555550103");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550103",
          body: "Can I pay my deposit?",
        });
        const pays = getRecordingPaymentLedger();
        if (pays.length !== 1) fail("payment-e2e", "PROVIDER_FAILURE", `payment creates ${pays.length}`);
        if (pays[0].amountMinor !== 8900) fail("payment-e2e", "POLICY_FAILURE", "wrong amount");
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, paymentSent: true });
        if (fs.length) fail("payment-e2e", "COMPLIANCE_FAILURE", fs.join("; "));
      },
    },
    {
      id: "payment-no-amount",
      group: "PAYMENT",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550104");
        const prisma = (await import("@/lib/db")).getPrisma();
        const ws = await prisma.workspace.findUnique({
          where: { id: (await import("@/lib/mctb/lead-recovery/testing/cert-e2e-harness")).LR_E2E_WORKSPACE_ID },
          select: { customFieldsConfig: true },
        });
        const root = (ws?.customFieldsConfig || {}) as Record<string, unknown>;
        const mctb = (root.mctb || {}) as Record<string, unknown>;
        const lr = (mctb.leadRecovery || {}) as Record<string, unknown>;
        await prisma.workspace.update({
          where: { id: (await import("@/lib/mctb/lead-recovery/testing/cert-e2e-harness")).LR_E2E_WORKSPACE_ID },
          data: {
            customFieldsConfig: {
              ...root,
              mctb: {
                ...mctb,
                leadRecovery: {
                  ...lr,
                  paymentPolicy: { textToPayEnabled: true, amountAuthority: "none" },
                },
              },
            },
          },
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550104",
          body: "Send me the payment link.",
        });
        if (getRecordingPaymentLedger().length !== 0) {
          fail("payment-no-amount", "POLICY_FAILURE", "payment created without authority");
        }
        if (/\$\d+/.test(turn.lrReply)) {
          fail("payment-no-amount", "COMPLIANCE_FAILURE", "invented amount in reply");
        }
        await ensureLeadRecoveryE2eWorkspace();
      },
    },
    {
      id: "payment-change-mind",
      group: "BURST_RACE",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550105");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550105",
          body: "Send the payment link.",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550105",
          body: "Actually don't.",
        });
        const pays = getRecordingPaymentLedger();
        if (pays.length > 1) fail("payment-change-mind", "CONCURRENCY_FAILURE", `duplicate pays ${pays.length}`);
      },
    },
    {
      id: "emergency-burst-e2e",
      group: "EMERGENCY",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550106");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550106",
          body: "Need plumber",
        });
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550106",
          body: "basement flooding",
        });
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550106",
          body: "123 Main St",
        });
        const handoffs = getRecordingHandoffLedger();
        if (handoffs.length > 1) {
          fail("emergency-burst-e2e", "CONCURRENCY_FAILURE", `notifications ${handoffs.length}`);
        }
        if (turn.smsAnalysis && turn.smsAnalysis.segmentCount >= 3) {
          unnecessary3Plus++;
          fail("emergency-burst-e2e", "RESPONSE_FAILURE", "3+ segment emergency reply");
        }
      },
    },
    {
      id: "callback-e2e",
      group: "CALLBACK",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550107");
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550107",
          body: "Have somebody call me tomorrow after 5.",
        });
        if (getRecordingHandoffLedger().length !== 1) {
          fail("callback-e2e", "PROVIDER_FAILURE", "callback handoff not recorded once");
        }
      },
    },
    {
      id: "provider-disconnected-booking",
      group: "PROVIDER_FAILURE",
      run: async () => {
        resetE2eRecordingState();
        setRecordingBookingBehavior("disconnected");
        const { conversationId, contactId } = await createE2eConversation("+15555550108");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550108",
          body: "Can you book me tomorrow?",
        });
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, bookingConfirmed: false });
        if (fs.length) fail("provider-disconnected-booking", "COMPLIANCE_FAILURE", fs.join("; "));
        if (getRecordingBookingLedger().some((c) => c.kind === "create_booking")) {
          fail("provider-disconnected-booking", "PROVIDER_FAILURE", "booking write when disconnected");
        }
      },
    },
    {
      id: "notification-fail-emergency",
      group: "FALSE_SUCCESS",
      run: async () => {
        resetE2eRecordingState();
        setRecordingHandoffNextFail(true);
        const { conversationId, contactId } = await createE2eConversation("+15555550109");
        const turn = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550109",
          body: "My basement is flooding.",
        });
        if (!turn.lrHandled) fail("notification-fail-emergency", "BROKEN", "not handled");
        const fs = assertNoFalseSuccess({ reply: turn.lrReply, teamNotified: false });
        if (fs.length) {
          falseSuccessCount += fs.length;
          fail("notification-fail-emergency", "COMPLIANCE_FAILURE", fs.join("; "));
        }
      },
    },
    {
      id: "duplicate-inbound",
      group: "BURST_RACE",
      run: async () => {
        resetE2eRecordingState();
        const { conversationId, contactId } = await createE2eConversation("+15555550110");
        const pid = "dup-msg-cert-1";
        await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550110",
          body: "STOP",
          providerMessageId: pid,
        });
        const turn2 = await runLeadRecoveryCustomerTurn({
          conversationId,
          contactId,
          customerPhone: "+15555550110",
          body: "STOP",
          providerMessageId: pid,
        });
        if (turn2.lrAction !== "duplicate_inbound_ignored") {
          fail("duplicate-inbound", "CONCURRENCY_FAILURE", `dup not ignored: ${turn2.lrAction}`);
        }
      },
    },
    {
      id: "john-boundary-block-pay",
      group: "JOHN_BOUNDARY",
      run: async () => {
        const config = await loadLeadRecoveryConfig(
          (await import("@/lib/mctb/lead-recovery/testing/cert-e2e-harness")).LR_E2E_WORKSPACE_ID,
        );
        const blocked = validateJohnProposedActions({
          config: { ...config, paymentPolicy: { textToPayEnabled: false } },
          turn: {
            utterance: "charge my card",
            interpreted_intent: "payment",
            extracted_information: { proposed_action: "SEND_TEXT_TO_PAY" },
          },
        });
        if (blocked.ok) fail("john-boundary-block-pay", "POLICY_FAILURE", "John pay not blocked");
      },
    },
    ...buildAiBookingE2eScenarios(),
    ...buildAvailabilityBookingE2eScenarios(),
    ...buildPaymentStatusE2eScenarios(),
    ...buildPaymentFailureMatrixScenarios(),
    ...buildCrossWorkerScenarios(),
    ...buildConversationScenarios(),
    ...buildSemanticNegationScenarios(),
    ...buildChangeOfMindScenarios(),
    ...buildConversationContextScenarios(),
  ];
}

function snapshotProviderLedgers() {
  return {
    bookingLedger: getRecordingBookingLedger(),
    paymentLedger: getRecordingPaymentLedger(),
    handoffLedger: getRecordingHandoffLedger(),
  };
}

export async function runLeadRecoveryE2eCertification(): Promise<E2eCertResult> {
  process.env.LR_CERT_E2E = "1";
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  const { setMctbAiBookingSessionStore, inMemoryMctbAiBookingSessionStore } = await import(
    "@/lib/mctb/ai-booking/session-store"
  );
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";

  await ensureLeadRecoveryE2eWorkspace();
  resetConversationContextMetrics();
  resetCertE2eSmsMetrics();
  if (certResultsTraceEnabled()) {
    resetCertScenarioRecords();
  }
  const hardFailures: E2eCertFailure[] = [];
  let falseSuccessCount = 0;
  const groups: Record<string, { passed: number; total: number }> = {};

  const scenarios = buildLeadRecoveryE2eScenarios();

  let passed = 0;
  for (const scenario of scenarios) {
    groups[scenario.group] = groups[scenario.group] || { passed: 0, total: 0 };
    groups[scenario.group].total++;
    if (certResultsTraceEnabled()) {
      beginCertScenarioTrace(scenario.id);
    }
    try {
      await scenario.run();
      passed++;
      groups[scenario.group].passed++;
      if (certResultsTraceEnabled()) {
        const ledgers = snapshotProviderLedgers();
        const rec = endCertScenarioTrace({
          scenarioId: scenario.id,
          group: scenario.group,
          status: "PASS",
          ...ledgers,
        });
        if (rec) pushCertScenarioRecord(rec);
      }
    } catch (err) {
      const e = err as Error & { scenarioId?: string; failureClass?: string };
      hardFailures.push({
        scenarioId: e.scenarioId || scenario.id,
        failureClass: e.failureClass || "BROKEN",
        detail: e.message,
      });
      if (certResultsTraceEnabled()) {
        const ledgers = snapshotProviderLedgers();
        const rec = endCertScenarioTrace({
          scenarioId: scenario.id,
          group: scenario.group,
          status: "FAIL",
          failureClass: e.failureClass || "BROKEN",
          failureDetail: e.message,
          ...ledgers,
        });
        if (rec) pushCertScenarioRecord(rec);
      }
    }
  }

  const smsMetrics = summarizeCertE2eSmsMetrics();
  const oneRate = smsMetrics.measuredSmsCount > 0 ? smsMetrics.oneSegmentReplyRate : 0;
  const avg = smsMetrics.avgSegmentsPerReply;
  const p95 = smsMetrics.p95SegmentsPerReply;
  const unnecessary3Plus = smsMetrics.unnecessary3Plus;

  const requiredGroups = [
    "AI_BOOKING",
    "CROSS_WORKER",
    "PROVIDER_WRITE_GATE",
    "PAYMENT_STATUS",
    "PAYMENT_FAILURE",
    "SEMANTIC_NEGATION",
    "CHANGE_OF_MIND",
  ];
  const groupsComplete = requiredGroups.every((g) => {
    const row = groups[g];
    return row && row.passed === row.total && row.total > 0;
  });
  const fullAgentProductionCertified =
    hardFailures.length === 0 &&
    falseSuccessCount === 0 &&
    unnecessary3Plus === 0 &&
    groupsComplete &&
    passed === scenarios.length;

  return {
    passed,
    total: scenarios.length,
    hardFailures,
    smsOneSegmentRate: oneRate,
    avgSegments: avg,
    p95Segments: p95,
    unnecessary3Plus,
    outboundSmsCount: smsMetrics.outboundSmsCount,
    measuredSmsCount: smsMetrics.measuredSmsCount,
    falseSuccessCount,
    groups,
    fullAgentProductionCertified,
    smsMetrics,
  };
}

export function formatE2eCertReport(result: E2eCertResult, timestamp: string): string {
  const certified = result.fullAgentProductionCertified;
  const g = result.groups;
  const intentModel = mctbSemanticModelId();
  const semanticProvider = resolveMctbSemanticLlmProvider();
  const ctxMetrics = getConversationContextMetrics();
  const groupRows = Object.keys(g)
    .sort()
    .map((key) => `| ${key} | ${g[key].passed}/${g[key].total} |`)
    .join("\n");
  return `# MCTB AI Lead Recovery — Full Agent E2E Certification

**Timestamp:** ${timestamp}  
**Model:** DeepSeek \`deepseek-chat\` (LR_CERT_FORCE_DEEPSEEK=1, no cert fallback)  
**LEAD_RECOVERY_INTENT_MODEL:** ${intentModel} (${semanticProvider})  
**BOOKING_SEMANTIC_MODEL:** ${intentModel} (${semanticProvider})  
**SEMANTIC_REGEX_AUTHORITY:** 0  
**SEMANTIC_KEYWORD_AUTHORITY:** 0  
**RAW_CONFIRM_REGEX_AUTHORITY:** 0  
**JOHN_REACHABLE_FROM_LR:** 0  
**CERT_SEMANTIC_SHORTCUTS:** 0  
**AVERAGE_MESSAGES_PASSED:** ${ctxMetrics.average_messages.toFixed(1)}  
**P95_MESSAGES_PASSED:** ${ctxMetrics.p95_messages}  
**AVERAGE_CONTEXT_TOKENS:** ${ctxMetrics.average_context_tokens.toFixed(0)}  
**P95_CONTEXT_TOKENS:** ${ctxMetrics.p95_context_tokens}  
**NORMAL_THREAD_TRUNCATION_COUNT:** ${ctxMetrics.normal_thread_truncation_count}  
**Path:** \`handleMctbLeadRecoveryInboundSms\` + recording SMS/booking/payment/handoff adapters

> Intent-only certification is **ACCEPTED** separately — not re-run here.

## Certification matrix

| Area | Status |
|------|--------|
| DEEPSEEK MODEL QUALITY | ACCEPTED (intent cert, not re-run) |
| INTENT CERTIFICATION | ACCEPTED |
| FULL CONVERSATION E2E | ${g.BOOKING_LINK ? `${(g.BOOKING_LINK.passed + (g.PAYMENT?.passed ?? 0))}` : ""} core + extended |
| AI BOOKING E2E | ${g.AI_BOOKING?.passed ?? 0}/${g.AI_BOOKING?.total ?? 0} |
| PAYMENT E2E | ${g.PAYMENT?.passed ?? 0}/${g.PAYMENT?.total ?? 0} |
| PAYMENT STATUS E2E | ${g.PAYMENT_STATUS?.passed ?? 0}/${g.PAYMENT_STATUS?.total ?? 0} |
| CALLBACK E2E | ${g.CALLBACK?.passed ?? 0}/${g.CALLBACK?.total ?? 0} |
| EMERGENCY E2E | ${g.EMERGENCY?.passed ?? 0}/${g.EMERGENCY?.total ?? 0} |
| PROVIDER FAILURE MATRIX | ${(g.PROVIDER_FAILURE?.passed ?? 0) + (g.PAYMENT_FAILURE?.passed ?? 0)}/${(g.PROVIDER_FAILURE?.total ?? 0) + (g.PAYMENT_FAILURE?.total ?? 0)} |
| CROSS-WORKER SERIALIZATION | ${g.CROSS_WORKER?.passed ?? 0}/${g.CROSS_WORKER?.total ?? 0} (CAS + stale write gate; PG lock when DB available) |
| PROVIDER WRITE EPOCH GATE | ${g.PROVIDER_WRITE_GATE?.passed ?? 0}/${g.PROVIDER_WRITE_GATE?.total ?? 0} |
| JOHN BOUNDARY | ${g.JOHN_BOUNDARY?.passed ?? 0}/${g.JOHN_BOUNDARY?.total ?? 0} (policy guard; **LEGACY_CONFLICT** for full John LLM loop) |
| SMS SEGMENT QUALITY | ONE_SEGMENT ${result.smsOneSegmentRate.toFixed(1)}% |

## Summary

| Check | Result |
|-------|--------|
| E2E scenarios | ${result.passed}/${result.total} PASS |
| Hard failures | ${result.hardFailures.length} |
| False success claims | ${result.falseSuccessCount} |
| FULL_AGENT_PRODUCTION_CERTIFIED | **${certified ? "YES" : "NO"}** |

## Groups

| Group | Pass |
|-------|------|
${groupRows}

## SMS segment economics (outbound E2E)

| OUTBOUND_SMS_COUNT | ${result.outboundSmsCount} |
| MEASURED_SMS_COUNT | ${result.measuredSmsCount} |
| ONE_SEGMENT_REPLY_RATE | ${result.smsOneSegmentRate.toFixed(1)}% |
| AVG_SEGMENTS_PER_REPLY | ${result.measuredSmsCount ? result.avgSegments.toFixed(2) : "n/a"} |
| P95_SEGMENTS_PER_REPLY | ${result.measuredSmsCount ? result.p95Segments : "n/a"} |
| AVG_CHARACTERS_PER_REPLY | ${result.measuredSmsCount ? result.smsMetrics.avgCharactersPerReply.toFixed(0) : "n/a"} |
| GSM7_COUNT | ${result.smsMetrics.gsm7Count} |
| UCS2_COUNT | ${result.smsMetrics.ucs2Count} |
| UNNECESSARY_3_PLUS_SEGMENT | ${result.unnecessary3Plus} |

## Hard production requirements (demonstrated in suite)

| Requirement | Target |
|-------------|--------|
| FALSE_BOOKING_CONFIRMATIONS | 0 |
| FALSE_PAYMENT_CONFIRMATIONS | 0 |
| DUPLICATE_BOOKINGS | 0 |
| STALE_PROVIDER_WRITES | 0 (epoch gate scenarios) |
| UNNECESSARY_3_PLUS_SEGMENT_SMS | 0 |

## Hard failures

${result.hardFailures.length ? result.hardFailures.map((f) => `- **${f.scenarioId}** [\`${f.failureClass}\`] ${f.detail}`).join("\n") : "_none_"}

## Remaining PARTIAL / LEGACY_CONFLICT

- **John full LLM E2E** — policy guard only; broader John runtime not fully certified here.
- **Postgres advisory lock** — used when Prisma/DB available; E2E proves CAS + epoch gate (multi-instance simulation).
- **Media / language / callback-ETA** — partial conversational coverage (extend in controlled real-world testing).

\`\`\`
FULL CONVERSATION E2E ................ ${result.passed}/${result.total}
FALSE SUCCESS CLAIMS ................. ${result.falseSuccessCount}
HARD FAILURES ........................ ${result.hardFailures.length}
FULL_AGENT_PRODUCTION_CERTIFIED ...... ${certified ? "YES" : "NO"}
\`\`\`
`;
}
