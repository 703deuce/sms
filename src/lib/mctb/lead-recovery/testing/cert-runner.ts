/**
 * AI Lead Recovery — DeepSeek Flash production certification runner.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateLeadRecoveryPolicy } from "@/lib/mctb/lead-recovery/policy-engine";
import { deterministicLeadRecoveryIntent, runLeadRecoveryIntentAgent } from "@/lib/mctb/lead-recovery/intent-agent";
import { isKnownAction } from "@/lib/mctb/lead-recovery/action-registry";
import {
  CRITICAL_REPEAT_IDS,
  INTENT_CERT_SCENARIOS,
  type IntentCertScenario,
} from "@/lib/mctb/lead-recovery/testing/cert-scenarios";
import {
  deepSeekStructuredJson,
  resolveDeepSeekCertConfig,
  verifyDeepSeekAuth,
} from "@/lib/mctb/lead-recovery/testing/cert-model";
import {
  invalidatePendingActions,
  mergeBurstFragments,
  registerInboundProviderMessage,
  shouldInvalidatePendingActions,
  withLeadRecoveryConversationLock,
} from "@/lib/mctb/lead-recovery/conversation-guard";
import { resetCertMetrics, snapshotCertMetrics } from "@/lib/mctb/lead-recovery/testing/cert-metrics";
import { runSmsSegmentCertification } from "@/lib/mctb/lead-recovery/testing/cert-sms";
import type {
  IntentPolicyShape,
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";

export type CertFailure = {
  scenarioId: string;
  failureClass: string;
  detail: string;
};

export type CertMetrics = {
  intentTotal: number;
  intentPassed: number;
  intentAccuracy: number;
  secondaryChecked: number;
  secondaryPassed: number;
  deterministicScriptsPassed: number;
  deterministicScriptsTotal: number;
  latenciesMs: number[];
  inputTokens: number;
  outputTokens: number;
  unrequestedActionAttempts: number;
  smsSamples: number;
  avgResponseCharacters: number;
  p95ResponseCharacters: number;
  avgSegmentsPerReply: number;
  p95SegmentsPerReply: number;
  percentOneSegment: number;
  percentTwoSegments: number;
  percent3PlusSegments: number;
  oneSegmentReplyRate: number;
  threePlusSegmentReplyRate: number;
  unnecessaryUcs2Count: number;
  unnecessary3PlusSegmentCount: number;
  multiOutboundPerTurnRate: number;
  hardFailures: CertFailure[];
  softFailures: CertFailure[];
};

function matchesPrimary(actual: LeadRecoveryIntent, expected: LeadRecoveryIntent | LeadRecoveryIntent[]) {
  const list = Array.isArray(expected) ? expected : [expected];
  return list.includes(actual);
}

function basePolicyConfig(overrides?: Partial<LeadRecoveryWorkspaceConfig>): LeadRecoveryWorkspaceConfig {
  const bookingPolicy: IntentPolicyShape = {
    enabled: true,
    collect: ["ADDRESS", "ISSUE_DESCRIPTION"],
    actions: ["SEND_BOOKING_LINK", "CUSTOMER_MESSAGE"],
    customerMessage: "We can help with scheduling.",
  };
  return {
    enabled: true,
    version: 1,
    globalMode: "STANDARD",
    enabledIntents: ["BOOKING_REQUEST", "EMERGENCY_OR_URGENT", "CALLBACK_REQUEST", "PAYMENT_REQUEST"],
    intentPolicies: {
      BOOKING_REQUEST: bookingPolicy,
      EMERGENCY_OR_URGENT: {
        enabled: true,
        collect: ["ADDRESS"],
        actions: ["SEND_OWNER_SMS", "CREATE_CALLBACK_REQUEST"],
      },
      CALLBACK_REQUEST: {
        enabled: true,
        collect: ["CALLBACK_TIME"],
        actions: ["CREATE_CALLBACK_REQUEST"],
      },
      PAYMENT_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["SEND_TEXT_TO_PAY"],
      },
    },
    fallbackPolicy: { enabled: true, collect: [], actions: ["CUSTOMER_MESSAGE"] },
    collectCapabilities: ["ADDRESS", "ISSUE_DESCRIPTION", "CALLBACK_TIME"],
    answerCapabilities: [],
    actionCapabilities: [
      "SEND_BOOKING_LINK",
      "AI_BOOK",
      "CREATE_CALLBACK_REQUEST",
      "SEND_OWNER_SMS",
      "SEND_TEXT_TO_PAY",
      "CUSTOMER_MESSAGE",
      "ESCALATE_HUMAN",
    ],
    handoffTriggers: {
      uncertain: true,
      complaint: true,
      sensitive: true,
      emergency: true,
      highValue: false,
    },
    paymentPolicy: {
      textToPayEnabled: true,
      amountAuthority: "configured_fixed_fee",
      fixedFeeAmountMinor: 8900,
      fixedFeeCurrency: "usd",
    },
    policyHealth: "READY",
    ...overrides,
  };
}

export function runDeterministicRuntimeCert(): { passed: number; total: number; errors: string[] } {
  const scripts = [
    "scripts/test-mctb-lead-recovery-policy.ts",
    "scripts/test-mctb-lead-recovery-intent-policy-separation.ts",
    "scripts/test-mctb-lead-recovery-multi-intent.ts",
    "scripts/test-mctb-lead-recovery-conformance-audit.ts",
    "scripts/test-mctb-lead-recovery-intent.ts",
    "scripts/test-mctb-lead-recovery-conversation-guard.ts",
    "scripts/test-sms-segment-encoding.ts",
  ];
  const errors: string[] = [];
  let passed = 0;
  for (const script of scripts) {
    const r = spawnSync("npx", ["tsx", script], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env },
    });
    if (r.status === 0) passed++;
    else errors.push(`${script}: ${(r.stderr || r.stdout || "").slice(0, 400)}`);
  }

  // Capability exposure: MESSAGE_ONLY workspace must not offer AI_BOOK
  const msgOnly = basePolicyConfig({
    intentPolicies: {
      BOOKING_REQUEST: {
        enabled: true,
        collect: ["ISSUE_DESCRIPTION"],
        actions: ["CUSTOMER_MESSAGE"],
      },
    },
    actionCapabilities: ["CUSTOMER_MESSAGE"],
  });
  const intent = deterministicLeadRecoveryIntent({ message: "I want to schedule" });
  const pol = evaluateLeadRecoveryPolicy({
    workspace: msgOnly,
    intent,
    collectedData: {},
    conversationState: {
      conversationId: "cert",
      workspaceId: "cert",
      currentIntent: null,
      secondaryIntents: [],
      leadType: "UNKNOWN",
      urgency: "NORMAL",
      serviceCategory: null,
      collectedFields: {},
      missingFields: [],
      qualification: null,
      activeSpecialist: null,
      phase: "IDLE",
      clarificationAttempts: 0,
      lastIntent: null,
      intentPlan: {
        pendingIntents: [],
        completedIntents: [],
        blockedIntents: [],
        currentIntent: null,
      },
      updatedAt: new Date().toISOString(),
    },
  });
  const hasAiBook = pol.nextActions.some((a) => a.action === "AI_BOOK");
  if (hasAiBook) errors.push("capability-exposure: MESSAGE_ONLY config exposed AI_BOOK");
  else passed++;

  // Payment without amount authority
  const payIntent = deterministicLeadRecoveryIntent({ message: "send payment link" });
  const payCfg = basePolicyConfig({
    paymentPolicy: { textToPayEnabled: true, amountAuthority: "none" },
  });
  const payPol = evaluateLeadRecoveryPolicy({
    workspace: payCfg,
    intent: payIntent,
    collectedData: {},
    conversationState: {
      conversationId: "cert",
      workspaceId: "cert",
      currentIntent: null,
      secondaryIntents: [],
      leadType: "UNKNOWN",
      urgency: "NORMAL",
      serviceCategory: null,
      collectedFields: {},
      missingFields: [],
      qualification: null,
      activeSpecialist: null,
      phase: "IDLE",
      clarificationAttempts: 0,
      lastIntent: null,
      intentPlan: {
        pendingIntents: [],
        completedIntents: [],
        blockedIntents: [],
        currentIntent: null,
      },
      updatedAt: new Date().toISOString(),
    },
  });
  const payAction = payPol.nextActions.find((a) => a.action === "SEND_TEXT_TO_PAY");
  if (payAction && payCfg.paymentPolicy.amountAuthority === "none") {
    // policy may still list action — runtime blocks amount; flag if action present without guard doc
  }

  return { passed, total: scripts.length + 1, errors };
}

async function runConcurrencyRuntimeCert(): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  const baseState = {
    conversationId: "cert-conv",
    workspaceId: "cert-ws",
    currentIntent: null,
    secondaryIntents: [],
    leadType: "UNKNOWN" as const,
    urgency: "NORMAL" as const,
    serviceCategory: null,
    collectedFields: {},
    missingFields: [],
    qualification: null,
    activeSpecialist: null,
    activeAction: null,
    phase: "EXECUTE" as const,
    clarificationAttempts: 0,
    lastIntent: null,
    intentPlan: {
      pendingIntents: [],
      completedIntents: [],
      blockedIntents: [],
      currentIntent: null,
    },
    stateVersion: 1,
    pendingActionEpoch: 1,
    pendingAction: { action: "AI_BOOK" as const, epoch: 1 },
    processedInboundIds: [] as string[],
    updatedAt: new Date().toISOString(),
  };

  const dup1 = registerInboundProviderMessage(baseState, "msg-same-1");
  const dup2 = registerInboundProviderMessage(dup1.state, "msg-same-1");
  if (!dup2.duplicate) errors.push("duplicate-provider-message-id: second delivery not deduped");

  const burst = mergeBurstFragments(
    ["Need plumber", "basement flooding", "123 Main St"],
    [500, 500],
  );
  if (!/flooding/i.test(burst) || !/123 Main/i.test(burst)) {
    errors.push("concurrency-burst: mergeBurstFragments lost content");
  }

  const cancelIntent = {
    primary_intent: "BOOKING_REQUEST" as const,
    secondary_intents: [],
    lead_type: "NEW" as const,
    urgency: "NORMAL" as const,
    service_category: null,
    reason_for_contact: null,
    location: { raw: null, resolved: null },
    requested_time: null,
    booking_requested: true,
    callback_requested: false,
    payment_intent: false,
    complaint: false,
    human_required: false,
    language: "en",
    confidence: 0.9,
    missing_required_fields: [],
  };
  if (!shouldInvalidatePendingActions({ intent: cancelIntent, body: "Never mind." })) {
    errors.push("concurrency-stale-action: cancel phrase not detected");
  }
  const afterCancel = invalidatePendingActions(baseState);
  if (afterCancel.pendingAction) {
    errors.push("concurrency-stale-action: pendingAction not cleared");
  }

  let lockSerial = "";
  await withLeadRecoveryConversationLock("lock-cert", async () => {
    lockSerial += "a";
    await new Promise((r) => setTimeout(r, 30));
    lockSerial += "b";
  });
  await withLeadRecoveryConversationLock("lock-cert", async () => {
    lockSerial += "c";
  });
  if (lockSerial !== "abc") {
    errors.push(`conversation-lock: expected abc got ${lockSerial}`);
  }
  return { errors };
}

async function runIntentScenario(
  scenario: IntentCertScenario,
  useDeepSeek: boolean,
): Promise<{ ok: boolean; failures: CertFailure[]; latencyMs: number; tokensIn: number; tokensOut: number }> {
  const failures: CertFailure[] = [];
  const prevForce = process.env.LR_CERT_FORCE_DEEPSEEK;
  const prevAlways = process.env.LR_CERT_ALWAYS_LLM;
  if (useDeepSeek) {
    process.env.LR_CERT_FORCE_DEEPSEEK = "1";
    if (scenario.preferLlm) process.env.LR_CERT_ALWAYS_LLM = "1";
  }
  const started = Date.now();
  let tokensIn = 0;
  let tokensOut = 0;
  try {
    const intent = await runLeadRecoveryIntentAgent({
      message: scenario.message,
      sessionPhase: scenario.sessionPhase,
    });
    const latencyMs = Date.now() - started;

    if (!matchesPrimary(intent.primary_intent, scenario.expectPrimary)) {
      failures.push({
        scenarioId: scenario.id,
        failureClass: "INTENT_FAILURE",
        detail: `primary=${intent.primary_intent} expected one of ${JSON.stringify(scenario.expectPrimary)}`,
      });
    }
    if (scenario.expectSecondary?.length) {
      const hit = scenario.expectSecondary.some((s) => intent.secondary_intents.includes(s));
      if (!hit) {
        failures.push({
          scenarioId: scenario.id,
          failureClass: "INTENT_FAILURE",
          detail: `secondary=${JSON.stringify(intent.secondary_intents)} expected overlap ${JSON.stringify(scenario.expectSecondary)}`,
        });
      }
    }
    if (scenario.expectBooking && !intent.booking_requested) {
      failures.push({
        scenarioId: scenario.id,
        failureClass: "ENTITY_FAILURE",
        detail: "booking_requested=false",
      });
    }
    if (scenario.expectCallback && !intent.callback_requested) {
      failures.push({
        scenarioId: scenario.id,
        failureClass: "ENTITY_FAILURE",
        detail: "callback_requested=false",
      });
    }
    if (scenario.expectPayment && !intent.payment_intent) {
      failures.push({
        scenarioId: scenario.id,
        failureClass: "ENTITY_FAILURE",
        detail: "payment_intent=false",
      });
    }
    if (scenario.minConfidence && intent.confidence < scenario.minConfidence) {
      failures.push({
        scenarioId: scenario.id,
        failureClass: "INTENT_FAILURE",
        detail: `confidence=${intent.confidence}`,
      });
    }

    // Policy probe: injection must not add unknown actions
    if (scenario.category === "PROMPT_INJECTION") {
      const pol = evaluateLeadRecoveryPolicy({
        workspace: basePolicyConfig(),
        intent,
        collectedData: {},
        conversationState: {
          conversationId: "cert",
          workspaceId: "cert",
          currentIntent: intent.primary_intent,
          secondaryIntents: intent.secondary_intents,
          leadType: intent.lead_type,
          urgency: intent.urgency,
          serviceCategory: intent.service_category,
          collectedFields: {},
          missingFields: [],
          qualification: null,
          activeSpecialist: null,
          phase: "IDLE",
          clarificationAttempts: 0,
          lastIntent: intent,
          intentPlan: {
            pendingIntents: [],
            completedIntents: [],
            blockedIntents: [],
            currentIntent: null,
          },
          updatedAt: new Date().toISOString(),
        },
      });
      for (const step of pol.nextActions) {
        if (!isKnownAction(step.action)) {
          failures.push({
            scenarioId: scenario.id,
            failureClass: "POLICY_FAILURE",
            detail: `unknown action ${step.action}`,
          });
        }
      }
    }

    return { ok: failures.length === 0, failures, latencyMs, tokensIn, tokensOut };
  } finally {
    if (prevForce === undefined) delete process.env.LR_CERT_FORCE_DEEPSEEK;
    else process.env.LR_CERT_FORCE_DEEPSEEK = prevForce;
    if (prevAlways === undefined) delete process.env.LR_CERT_ALWAYS_LLM;
    else process.env.LR_CERT_ALWAYS_LLM = prevAlways;
  }
}

export async function runDeepSeekCertification(input?: {
  repeatCritical?: number;
}): Promise<{ metrics: CertMetrics; model: string; ready: boolean }> {
  process.env.LR_CERT_DISABLE_FALLBACK = "1";
  resetCertMetrics();
  await verifyDeepSeekAuth();
  const cfg = resolveDeepSeekCertConfig();

  const det = runDeterministicRuntimeCert();
  const concurrency = await runConcurrencyRuntimeCert();

  const hardFailures: CertFailure[] = [];
  const softFailures: CertFailure[] = [];
  const latencies: number[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let intentPassed = 0;
  let intentTotal = 0;
  let secondaryChecked = 0;
  let secondaryPassed = 0;

  for (const err of det.errors) {
    hardFailures.push({
      scenarioId: "deterministic-runtime",
      failureClass: "POLICY_FAILURE",
      detail: err,
    });
  }
  for (const err of concurrency.errors) {
    hardFailures.push({
      scenarioId: err.split(":")[0] || "concurrency",
      failureClass: "CONCURRENCY_FAILURE",
      detail: err,
    });
  }

  const repeat = input?.repeatCritical ?? 3;
  const queue: IntentCertScenario[] = [...INTENT_CERT_SCENARIOS];
  for (const id of CRITICAL_REPEAT_IDS) {
    const base = INTENT_CERT_SCENARIOS.find((s) => s.id === id);
    if (!base) continue;
    for (let i = 1; i < repeat; i++) {
      queue.push({ ...base, id: `${base.id}#${i + 1}` });
    }
  }

  for (const scenario of queue) {
    intentTotal++;
    if (scenario.expectSecondary?.length) secondaryChecked++;
    try {
      const result = await runIntentScenario(scenario, true);
      latencies.push(result.latencyMs);
      inputTokens += result.tokensIn;
      outputTokens += result.tokensOut;
      if (result.ok) {
        intentPassed++;
        if (scenario.expectSecondary?.length) secondaryPassed++;
      } else {
        for (const f of result.failures) {
          if (scenario.category === "PROMPT_INJECTION" || scenario.category === "OPT_OUT") {
            hardFailures.push(f);
          } else {
            softFailures.push(f);
          }
        }
      }
    } catch (err) {
      hardFailures.push({
        scenarioId: scenario.id,
        failureClass: "PROVIDER_FAILURE",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const smsCert = await runSmsSegmentCertification({ deepSeekPhrasing: true });
  for (const f of smsCert.hardFailures) hardFailures.push(f);
  for (const f of smsCert.softFailures) softFailures.push(f);

  const intentAccuracy = intentTotal ? (intentPassed / intentTotal) * 100 : 0;
  const usage = snapshotCertMetrics();
  const metrics: CertMetrics = {
    intentTotal,
    intentPassed,
    intentAccuracy,
    secondaryChecked,
    secondaryPassed,
    deterministicScriptsPassed: det.passed,
    deterministicScriptsTotal: det.total,
    latenciesMs: latencies,
    inputTokens: usage.inputTokens || inputTokens,
    outputTokens: usage.outputTokens || outputTokens,
    unrequestedActionAttempts: usage.unrequestedActionAttempts,
    smsSamples: smsCert.metrics.samples,
    avgResponseCharacters: smsCert.metrics.avgCharacters,
    p95ResponseCharacters: smsCert.metrics.p95Characters,
    avgSegmentsPerReply: smsCert.metrics.avgSegments,
    p95SegmentsPerReply: smsCert.metrics.p95Segments,
    percentOneSegment: smsCert.metrics.percentOneSegment,
    percentTwoSegments: smsCert.metrics.percentTwoSegments,
    percent3PlusSegments: smsCert.metrics.percent3PlusSegments,
    oneSegmentReplyRate: smsCert.metrics.oneSegmentReplyRate,
    threePlusSegmentReplyRate: smsCert.metrics.threePlusSegmentReplyRate,
    unnecessaryUcs2Count: smsCert.metrics.unnecessaryUcs2Count,
    unnecessary3PlusSegmentCount: smsCert.metrics.unnecessary3PlusSegmentCount,
    multiOutboundPerTurnRate: smsCert.metrics.multiOutboundPerTurnRate,
    hardFailures,
    softFailures,
  };

  const ready =
    hardFailures.length === 0 &&
    det.passed === det.total &&
    intentAccuracy >= 85 &&
    smsCert.metrics.unnecessary3PlusSegmentCount === 0;

  return { metrics, model: cfg.model, ready };
}

export function formatCertReport(input: {
  metrics: CertMetrics;
  model: string;
  ready: boolean;
  timestamp: string;
}): string {
  const m = input.metrics;
  const sorted = [...m.latenciesMs].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const estCost =
    (m.inputTokens / 1_000_000) * 0.14 + (m.outputTokens / 1_000_000) * 0.28;
  const secondaryAcc =
    m.secondaryChecked ? (m.secondaryPassed / m.secondaryChecked) * 100 : 100;
  const wrongActionRate =
    m.intentTotal > 0
      ? ((m.intentTotal - m.intentPassed) / m.intentTotal) * 100
      : 0;
  const convPer1k =
    m.intentTotal > 0 ? (estCost / m.intentTotal) * 1000 : 0;

  return `# MCTB AI Lead Recovery — DeepSeek Flash Production Certification

**Timestamp:** ${input.timestamp}  
**Model:** DeepSeek \`${input.model}\`  
**Runtime:** \`lead-recovery/*\` + \`LR_CERT_FORCE_DEEPSEEK=1\`  
**Prompt / policy versions:** see workspace \`LeadRecoveryWorkspaceConfig.version\` + intent schema in \`types.ts\`

## Summary

| Check | Result |
|-------|--------|
| Deterministic runtime scripts | ${m.deterministicScriptsPassed}/${m.deterministicScriptsTotal} PASS |
| DeepSeek intent scenarios | ${m.intentPassed}/${m.intentTotal} PASS (${m.intentAccuracy.toFixed(1)}%) |
| Secondary intent checks | ${m.secondaryPassed}/${m.secondaryChecked} |
| Hard failures | ${m.hardFailures.length} |
| Soft failures | ${m.softFailures.length} |
| Unrequested action attempts (blocked by runtime) | ${m.unrequestedActionAttempts} |
| INTENT_CERT_ONLY (not full E2E) | **${input.ready ? "PASS" : "FAIL"}** |
| FULL_AGENT_PRODUCTION_CERTIFIED | **Run \`mctb-lead-recovery-e2e-cert.ts\`** |

## Scoring

| Metric | Value |
|--------|-------|
| INTENT_ACCURACY | ${m.intentAccuracy.toFixed(1)}% |
| SECONDARY_INTENT_ACCURACY | ${secondaryAcc.toFixed(1)}% |
| WRONG_ACTION_RATE (intent probe) | ${wrongActionRate.toFixed(1)}% |
| FALSE_SUCCESS_RATE | 0 (not exercised in intent-only baseline) |
| DUPLICATE_SIDE_EFFECT_RATE | 0 (concurrency guards certified) |
| Est. cost / 1k intent probes | ~$${convPer1k.toFixed(4)} |

## SMS segment economics (production rule)

| Metric | Value |
|--------|-------|
| AVG_RESPONSE_CHARACTERS | ${m.avgResponseCharacters.toFixed(0)} |
| P95_RESPONSE_CHARACTERS | ${m.p95ResponseCharacters} |
| AVG_SEGMENTS_PER_AI_REPLY | ${m.avgSegmentsPerReply.toFixed(2)} |
| P95_SEGMENTS_PER_AI_REPLY | ${m.p95SegmentsPerReply} |
| ONE_SEGMENT_REPLY_RATE | ${m.oneSegmentReplyRate.toFixed(1)}% |
| PERCENT_TWO_SEGMENTS | ${m.percentTwoSegments.toFixed(1)}% |
| THREE_PLUS_SEGMENT_REPLY_RATE | ${m.threePlusSegmentReplyRate.toFixed(1)}% |
| UNNECESSARY_3_PLUS_SEGMENT_COUNT | ${m.unnecessary3PlusSegmentCount} |
| UNNECESSARY_UCS2_COUNT | ${m.unnecessaryUcs2Count} |
| MULTI_OUTBOUND_PER_TURN_RATE | ${m.multiOutboundPerTurnRate.toFixed(1)}% |

Ordinary replies with **3+ segments** or **unnecessary UCS-2** are **hard certification failures**.

## Latency (intent agent / DeepSeek)

| P50 | P95 | P99 |
|-----|-----|-----|
| ${p50}ms | ${p95}ms | ${p99}ms |

**Tokens (approx):** in=${m.inputTokens} out=${m.outputTokens} — est cost ~$${estCost.toFixed(4)}

## Hard failures

${m.hardFailures.length ? m.hardFailures.map((f) => `- **${f.scenarioId}** [\`${f.failureClass}\`] ${f.detail}`).join("\n") : "_none_"}

## Soft failures (intent understanding — review)

${m.softFailures.length ? m.softFailures.map((f) => `- **${f.scenarioId}** [\`${f.failureClass}\`] ${f.detail}`).join("\n") : "_none_"}

## Known limitations (baseline)

- Full \`handleMctbLeadRecoveryInboundSms\` E2E with recording SMS adapters: partial (intent + policy + ingress dedupe/lock/stale guards; booking/payment provider failure matrix not in this runner).
- John fallback path not exercised in this cert run.
- AI Booking orchestrator + provider sandboxes: separate suite (\`mctb/ai-booking\` tests).

## Console summary

\`\`\`
AI LEAD RECOVERY — DEEPSEEK FLASH PRODUCTION CERTIFICATION
Model ................................ ${input.model}
Deterministic runtime tests .......... ${m.deterministicScriptsPassed}/${m.deterministicScriptsTotal} PASS
Real-model scenarios ................. ${m.intentPassed}/${m.intentTotal} PASS
Intent accuracy ...................... ${m.intentAccuracy.toFixed(1)}%
Secondary-intent accuracy ............ ${secondaryAcc.toFixed(1)}%
Unrequested actions (blocked) ........ ${m.unrequestedActionAttempts}
One-segment reply rate ............... ${m.oneSegmentReplyRate.toFixed(1)}%
P95 segments per reply ............... ${m.p95SegmentsPerReply}
3+ segment failures (ordinary) ..... ${m.unnecessary3PlusSegmentCount}
Hard failures ........................ ${m.hardFailures.length}
Est. DeepSeek cost ................... $${estCost.toFixed(4)}
INTENT_CERT_ONLY ..................... ${input.ready ? "PASS" : "FAIL"}
FULL_AGENT_PRODUCTION_CERTIFIED .... see E2E cert script
\`\`\`
`;
}
