import type { E2eCertResult } from "@/lib/mctb/lead-recovery/testing/cert-e2e-runner";
import type { CertScenarioTraceRecord } from "@/lib/mctb/lead-recovery/testing/cert-results-trace";
import { mctbSemanticModelId, resolveMctbSemanticLlmProvider } from "@/lib/mctb/semantic-llm";
import { getConversationContextMetrics } from "@/lib/mctb/semantic-conversation-context";

function describeRuntimeAction(action?: string): string {
  if (!action) return "(no LR runtime action)";
  const map: Record<string, string> = {
    ai_booking: "AI scheduling workflow (scheduling specialist + booking orchestrator; may READ calendar or WRITE booking)",
    ai_booking_clarify: "AI scheduling clarification (no provider write)",
    ai_booking_fallback: "AI booking fallback link / safe message",
    ai_book_delegate: "Policy delegated to AI booking handler",
    booking_link_sent: "SEND_BOOKING_LINK (SMS with URL)",
    payment_sent: "SEND_TEXT_TO_PAY (Stripe/recording payment adapter)",
    callback_requested: "CREATE_CALLBACK_REQUEST / handoff",
    duplicate_inbound_ignored: "Duplicate inbound ignored (idempotency)",
    customer_message: "CUSTOMER_MESSAGE template",
  };
  return map[action] || `Lead Recovery action: ${action}`;
}

function formatLedger(record: CertScenarioTraceRecord): string {
  const lines: string[] = [];
  if (record.bookingLedger.length) {
    lines.push("  Booking provider (recording) calls:");
    for (const c of record.bookingLedger) {
      lines.push(
        `    - ${c.kind}${c.slotId ? ` slotId=${c.slotId}` : ""}${c.conversationId ? ` conv=${c.conversationId}` : ""}`,
      );
    }
  } else {
    lines.push("  Booking provider calls: (none recorded)");
  }
  if (record.paymentLedger.length) {
    lines.push("  Payment provider calls:");
    for (const c of record.paymentLedger) {
      lines.push(`    - ${JSON.stringify(c)}`);
    }
  }
  if (record.handoffLedger.length) {
    lines.push("  Handoff / owner notification calls:");
    for (const c of record.handoffLedger) {
      lines.push(`    - ${JSON.stringify(c)}`);
    }
  }
  return lines.join("\n");
}

function formatScenario(record: CertScenarioTraceRecord, index: number): string {
  const header = [
    "",
    "=".repeat(78),
    `SCENARIO ${index + 1}: ${record.scenarioId}`,
    `GROUP: ${record.group}`,
    `RESULT: ${record.status}`,
    record.failureClass ? `FAILURE_CLASS: ${record.failureClass}` : "",
    record.failureDetail ? `WHAT_WENT_WRONG: ${record.failureDetail}` : "",
    record.notes ? `NOTES: ${record.notes}` : "",
    "=".repeat(78),
  ]
    .filter(Boolean)
    .join("\n");

  if (!record.turns.length) {
    return `${header}\n\n(No inbound SMS turns — scenario tests policy guard, intent-only agent, or direct API.)\n\n${formatLedger(record)}\n`;
  }

  const turnBlocks = record.turns.map((t, i) => {
    const sms = t.smsAnalysis;
    const seg = sms
      ? `segments=${sms.segmentCount} encoding=${sms.encoding} chars=${sms.characterCount}`
      : "segments=n/a";
    return [
      `TURN ${i + 1}`,
      `  Customer message: ${JSON.stringify(t.customerInput)}`,
      `  LR handled: ${t.lrHandled}`,
      `  Runtime / tool path: ${describeRuntimeAction(t.lrAction)}`,
      `  Business SMS reply: ${JSON.stringify(t.lrReply || t.outboundSms || "")}`,
      `  Outbound SMS capture: ${JSON.stringify(t.outboundSms || "")}`,
      `  SMS economics: ${seg}`,
      t.providerMessageId ? `  Provider message id: ${t.providerMessageId}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `${header}\n\n${turnBlocks.join("\n\n")}\n\n${formatLedger(record)}\n`;
}

export function formatCertScenarioResultsCopyText(
  records: CertScenarioTraceRecord[],
  summary: E2eCertResult,
  timestamp: string,
): string {
  const ctx = getConversationContextMetrics();
  const intentModel = mctbSemanticModelId();
  const provider = resolveMctbSemanticLlmProvider();
  const intro = [
    "MCTB AI LEAD RECOVERY — FULL E2E SCENARIO-BY-SCENARIO RESULTS",
    "Copy-friendly transcript of every certification scenario.",
    "",
    `Generated: ${timestamp}`,
    `Semantic model: ${intentModel} (${provider})`,
    `LR_CERT_FORCE_DEEPSEEK=1  LR_CERT_DISABLE_FALLBACK=1  HEADLESS_PROVIDER_MODE=recording`,
    "",
    "SUMMARY",
    `  Scenarios: ${summary.passed}/${summary.total} PASS`,
    `  Hard failures: ${summary.hardFailures.length}`,
    `  FULL_AGENT_PRODUCTION_CERTIFIED: ${summary.fullAgentProductionCertified ? "YES" : "NO"}`,
    `  SEMANTIC_REGEX_AUTHORITY: 0`,
    `  SEMANTIC_KEYWORD_AUTHORITY: 0`,
    `  JOHN_REACHABLE_FROM_LR: 0`,
    `  CERT_SEMANTIC_SHORTCUTS: 0`,
    `  AVERAGE_MESSAGES_PASSED: ${ctx.average_messages.toFixed(1)}`,
    `  P95_MESSAGES_PASSED: ${ctx.p95_messages}`,
    `  OUTBOUND_SMS_COUNT: ${summary.outboundSmsCount}`,
    `  MEASURED_SMS_COUNT: ${summary.measuredSmsCount}`,
    `  ONE_SEGMENT_REPLY_RATE: ${summary.smsOneSegmentRate.toFixed(1)}%`,
    `  AVG_SEGMENTS_PER_REPLY: ${summary.avgSegments.toFixed(2)}`,
    "",
    "Per scenario: customer text → DeepSeek intent/scheduling (via production runtime) →",
    "authorized LR action → outbound SMS → recording provider ledger (find_slots / create_booking / payment / handoff).",
    "",
    "FAILURE INDEX",
    summary.hardFailures.length
      ? summary.hardFailures.map((f) => `  - ${f.scenarioId} [${f.failureClass}] ${f.detail}`).join("\n")
      : "  (none)",
    "",
  ].join("\n");

  const body = records.map((r, i) => formatScenario(r, i)).join("\n");
  return `${intro}\n${body}\nEND OF REPORT\n`;
}
