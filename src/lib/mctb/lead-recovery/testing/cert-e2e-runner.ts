import { getRecordingSmsOutbox } from "@/lib/voice/testing/headless/recording-sms";
import { setRecordingSmsNextFailure } from "@/lib/voice/testing/headless/recording-sms";
import { getRecordingPaymentLedger, setRecordingPaymentBehavior } from "@/lib/mctb/lead-recovery/testing/recording/recording-payment";
import { getRecordingHandoffLedger, setRecordingHandoffNextFail } from "@/lib/mctb/lead-recovery/testing/recording/recording-handoff";
import { getRecordingBookingLedger, setRecordingBookingBehavior } from "@/lib/mctb/lead-recovery/testing/recording/recording-booking";
import { assertNoFalseSuccess } from "@/lib/mctb/lead-recovery/testing/cert-e2e-false-success";
import {
  createE2eConversation,
  ensureLeadRecoveryE2eWorkspace,
  resetE2eRecordingState,
  runLeadRecoveryCustomerTurn,
} from "@/lib/mctb/lead-recovery/testing/cert-e2e-harness";
import { validateJohnProposedActions } from "@/lib/mctb/lead-recovery/john-policy-guard";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";

export type E2eCertFailure = { scenarioId: string; failureClass: string; detail: string };

export type E2eCertResult = {
  passed: number;
  total: number;
  hardFailures: E2eCertFailure[];
  smsOneSegmentRate: number;
  avgSegments: number;
  p95Segments: number;
  unnecessary3Plus: number;
  falseSuccessCount: number;
  groups: Record<string, { passed: number; total: number }>;
};

type Scenario = {
  id: string;
  group: string;
  run: () => Promise<void>;
};

function fail(id: string, cls: string, detail: string): never {
  throw Object.assign(new Error(detail), { scenarioId: id, failureClass: cls });
}

export async function runLeadRecoveryE2eCertification(): Promise<E2eCertResult> {
  process.env.LR_CERT_E2E = "1";
  const { setMctbAiBookingSessionStore, inMemoryMctbAiBookingSessionStore } = await import(
    "@/lib/mctb/ai-booking/session-store"
  );
  setMctbAiBookingSessionStore(inMemoryMctbAiBookingSessionStore);
  process.env.LR_CERT_FORCE_DEEPSEEK = "1";
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  process.env.HEADLESS_PROVIDER_MODE = "recording";

  await ensureLeadRecoveryE2eWorkspace();
  const hardFailures: E2eCertFailure[] = [];
  const segmentSamples: number[] = [];
  let falseSuccessCount = 0;
  let unnecessary3Plus = 0;
  const groups: Record<string, { passed: number; total: number }> = {};

  const scenarios: Scenario[] = [
    {
      id: "booking-link-e2e",
      group: "BOOKING_LINK",
      run: async () => {
        resetE2eRecordingState();
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
  ];

  let passed = 0;
  for (const scenario of scenarios) {
    groups[scenario.group] = groups[scenario.group] || { passed: 0, total: 0 };
    groups[scenario.group].total++;
    try {
      await scenario.run();
      passed++;
      groups[scenario.group].passed++;
    } catch (err) {
      const e = err as Error & { scenarioId?: string; failureClass?: string };
      hardFailures.push({
        scenarioId: e.scenarioId || scenario.id,
        failureClass: e.failureClass || "BROKEN",
        detail: e.message,
      });
    }
  }

  for (const sms of getRecordingSmsOutbox()) {
    const a = (await import("@/lib/sms/segment-encoding")).analyzeSmsBody(sms.body);
    segmentSamples.push(a.segmentCount);
  }

  const sorted = [...segmentSamples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const avg = segmentSamples.length
    ? segmentSamples.reduce((a, b) => a + b, 0) / segmentSamples.length
    : 0;
  const oneSeg = segmentSamples.filter((s) => s === 1).length;
  const oneRate = segmentSamples.length ? (oneSeg / segmentSamples.length) * 100 : 100;

  return {
    passed,
    total: scenarios.length,
    hardFailures,
    smsOneSegmentRate: oneRate,
    avgSegments: avg,
    p95Segments: p95,
    unnecessary3Plus,
    falseSuccessCount,
    groups,
  };
}

export function formatE2eCertReport(result: E2eCertResult, timestamp: string): string {
  const certified = result.hardFailures.length === 0;
  const g = result.groups;
  return `# MCTB AI Lead Recovery — Full Agent E2E Certification

**Timestamp:** ${timestamp}  
**Model:** DeepSeek \`deepseek-chat\` (LR_CERT_FORCE_DEEPSEEK=1)  
**Path:** \`handleMctbLeadRecoveryInboundSms\` + recording SMS/booking/payment/handoff adapters

> **Note:** Intent-only certification is separate. This document is **FULL AGENT E2E** only.

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
| BOOKING_LINK | ${g.BOOKING_LINK?.passed ?? 0}/${g.BOOKING_LINK?.total ?? 0} |
| PAYMENT | ${g.PAYMENT?.passed ?? 0}/${g.PAYMENT?.total ?? 0} |
| EMERGENCY | ${g.EMERGENCY?.passed ?? 0}/${g.EMERGENCY?.total ?? 0} |
| CALLBACK | ${g.CALLBACK?.passed ?? 0}/${g.CALLBACK?.total ?? 0} |
| PROVIDER_FAILURE | ${g.PROVIDER_FAILURE?.passed ?? 0}/${g.PROVIDER_FAILURE?.total ?? 0} |
| FALSE_SUCCESS | ${g.FALSE_SUCCESS?.passed ?? 0}/${g.FALSE_SUCCESS?.total ?? 0} |
| BURST_RACE | ${g.BURST_RACE?.passed ?? 0}/${g.BURST_RACE?.total ?? 0} |
| JOHN_BOUNDARY | ${g.JOHN_BOUNDARY?.passed ?? 0}/${g.JOHN_BOUNDARY?.total ?? 0} |

## SMS segment economics (outbound E2E)

| ONE_SEGMENT_REPLY_RATE | ${result.smsOneSegmentRate.toFixed(1)}% |
| AVG_SEGMENTS_PER_REPLY | ${result.avgSegments.toFixed(2)} |
| P95_SEGMENTS_PER_REPLY | ${result.p95Segments} |
| UNNECESSARY_3_PLUS_SEGMENT | ${result.unnecessary3Plus} |

## Hard failures

${result.hardFailures.length ? result.hardFailures.map((f) => `- **${f.scenarioId}** [\`${f.failureClass}\`] ${f.detail}`).join("\n") : "_none_"}

## Not yet in this runner (explicit gaps)

- Full AI booking slot selection → confirm → BOOKING_CONFIRMED persistence loop
- Payment status authoritative provider states (PAID/OPEN/FAILED)
- Cross-worker DB advisory lock certification (multi-process)
- John full LLM loop E2E
- Human request / who-is-this / media / language scenario groups (add next increment)

\`\`\`
FULL CONVERSATION E2E ................ ${result.passed}/${result.total}
FALSE SUCCESS CLAIMS ................. ${result.falseSuccessCount}
HARD FAILURES ........................ ${result.hardFailures.length}
FULL_AGENT_PRODUCTION_CERTIFIED ...... ${certified ? "YES" : "NO"}
\`\`\`
`;
}
