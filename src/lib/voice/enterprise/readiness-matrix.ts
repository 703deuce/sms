/**
 * Enterprise Agent Runtime — readiness audit matrix for Caller Amy.
 * Run: npx tsx scripts/enterprise-agent-audit-matrix.ts
 */

export type ReadinessLevel = "ENTERPRISE_READY" | "PARTIAL" | "MISSING";

export type AuditRow = {
  requirement: string;
  component: string;
  filePath: string;
  status: ReadinessLevel;
  why: string;
  mustChange: string;
};

export const ENTERPRISE_AUDIT_MATRIX: AuditRow[] = [
  {
    requirement: "1. LLM selects among permitted actions only",
    component: "Workflow tool guard + publish filter",
    filePath: "src/lib/voice/workflow-engine/guard.ts",
    status: "ENTERPRISE_READY",
    why: "assertToolAllowed enforces state-scoped tools; filterToolsForCallerAmyPublish limits Telnyx catalog.",
    mustChange: "None.",
  },
  {
    requirement: "2. Workflow engine with states + transitions",
    component: "Workflow engine v1",
    filePath: "src/lib/voice/workflow-engine/",
    status: "ENTERPRISE_READY",
    why: "States, transitions, recompute, agentRuntime on VoiceCall.metadata.",
    mustChange: "None for v1.",
  },
  {
    requirement: "3. Dynamic tool exposure by state",
    component: "STATE_ALLOWED_TOOLS + publish filter + runtime context",
    filePath: "src/lib/voice/workflow-engine/tool-publish.ts",
    status: "ENTERPRISE_READY",
    why: "allowed_tools injected per turn; publish filters to workflow union; server enforces.",
    mustChange: "None.",
  },
  {
    requirement: "4. Separate prompt layers",
    component: "Constitution + runtime injection",
    filePath: "src/lib/agents/appointment-booking/intelligence/caller-constitution.ts",
    status: "ENTERPRISE_READY",
    why: "Slim constitution prompt; tenant/workflow/state/tools via dynamic variables.",
    mustChange: "None.",
  },
  {
    requirement: "5. Professional tool descriptions",
    component: "Caller tool playbook + Telnyx webhook descriptions",
    filePath: "src/lib/agents/appointment-booking/intelligence/caller-tool-playbook.ts",
    status: "ENTERPRISE_READY",
    why: "whenToCall/never/parameters on all caller tools; USE/DO NOT on scheduling tools.",
    mustChange: "None.",
  },
  {
    requirement: "6. Strict structured schemas",
    component: "strict-tool-schema",
    filePath: "src/lib/voice/schema/strict-tool-schema.ts",
    status: "ENTERPRISE_READY",
    why: "additionalProperties:false applied to all Telnyx webhook body_parameters.",
    mustChange: "None.",
  },
  {
    requirement: "7. Config-driven field IDs",
    component: "Field runtime",
    filePath: "src/lib/voice/field-runtime/",
    status: "ENTERPRISE_READY",
    why: "Builder fields with stable field_id; save_caller_info removed from publish set.",
    mustChange: "None.",
  },
  {
    requirement: "8. record_current_field(value)",
    component: "Minimal field collection",
    filePath: "src/lib/voice/field-runtime/save.ts",
    status: "ENTERPRISE_READY",
    why: "Active field resolved from workflow state; Amy passes value only.",
    mustChange: "None.",
  },
  {
    requirement: "9. Immediate persistence",
    component: "workflowFieldSession",
    filePath: "src/lib/voice/field-runtime/session.ts",
    status: "ENTERPRISE_READY",
    why: "Each save writes to VoiceCall.metadata immediately.",
    mustChange: "None.",
  },
  {
    requirement: "10. State outside LLM",
    component: "agentRuntime + workflowFieldSession + executionTrace",
    filePath: "src/lib/voice/workflow-engine/runtime-state.ts",
    status: "ENTERPRISE_READY",
    why: "Authoritative state on call metadata survives context loss.",
    mustChange: "None.",
  },
  {
    requirement: "11. Idempotent operations + receipts",
    component: "Receipts + gateway workflows",
    filePath: "src/lib/voice/workflow-engine/receipts.ts",
    status: "ENTERPRISE_READY",
    why: "Unified operation receipts for book/hold/cancel/reschedule/sms.",
    mustChange: "None.",
  },
  {
    requirement: "12. No verbal success before confirmed result",
    component: "Gateway envelope may_confirm_to_caller",
    filePath: "src/lib/voice/agent-tool-gateway/envelope.ts",
    status: "ENTERPRISE_READY",
    why: "may_confirm_to_caller only on confirmed; constitution enforces truthfulness.",
    mustChange: "None.",
  },
  {
    requirement: "13. Async secondary work",
    component: "Voice outbox + provider sync jobs",
    filePath: "src/lib/voice/outbox/voice-outbox.ts",
    status: "ENTERPRISE_READY",
    why: "SMS, Calendly sync, cancel/reschedule provider ops off live path.",
    mustChange: "None.",
  },
  {
    requirement: "14. Machine-readable errors",
    component: "Agent tool gateway errors",
    filePath: "src/lib/voice/agent-tool-gateway/errors.ts",
    status: "ENTERPRISE_READY",
    why: "All gateway tools return error_code, retryable, next_action.",
    mustChange: "None.",
  },
  {
    requirement: "15. No interrupt during destructive writes",
    component: "Write lock + BOOKING_IN_PROGRESS guard",
    filePath: "src/lib/voice/workflow-engine/write-lock.ts",
    status: "ENTERPRISE_READY",
    why: "activeWriteLock blocks concurrent tools during irreversible ops.",
    mustChange: "None.",
  },
  {
    requirement: "16. Provider adapters behind domain interfaces",
    component: "SchedulingProvider interface",
    filePath: "src/lib/voice/providers/scheduling-provider.ts",
    status: "ENTERPRISE_READY",
    why: "Calendly + internal implement common SchedulingProvider.",
    mustChange: "None.",
  },
  {
    requirement: "17. Tool contract tests",
    component: "Gateway + live agent + gate tests",
    filePath: "scripts/test-agent-tool-gateway.ts",
    status: "ENTERPRISE_READY",
    why: "Contract tests + DB gate test in test:agent-runtime CI script.",
    mustChange: "None.",
  },
  {
    requirement: "18. Generated arbitrary field tests",
    component: "Field mutation tests",
    filePath: "scripts/test-field-runtime-mutations.ts",
    status: "ENTERPRISE_READY",
    why: "200 permutations in CI via test:agent-runtime.",
    mustChange: "None.",
  },
  {
    requirement: "19. Failure injection tests",
    component: "Gateway failure injection",
    filePath: "scripts/test-gateway-failure-injection.ts",
    status: "ENTERPRISE_READY",
    why: "Automated error translation scenarios for provider failures.",
    mustChange: "None.",
  },
  {
    requirement: "20. Tracing / reconstructability",
    component: "executionTrace + state_history + VoiceToolExecution",
    filePath: "src/lib/voice/workflow-engine/trace.ts",
    status: "ENTERPRISE_READY",
    why: "Per-call trace events + workflow state history + tool execution log.",
    mustChange: "None.",
  },
];

export function printAuditMatrix(rows: AuditRow[] = ENTERPRISE_AUDIT_MATRIX): void {
  const counts = { ENTERPRISE_READY: 0, PARTIAL: 0, MISSING: 0 };
  for (const row of rows) counts[row.status]++;

  console.log("\n=== Caller Amy Enterprise Readiness Matrix ===\n");
  console.log(
    `READY: ${counts.ENTERPRISE_READY} | PARTIAL: ${counts.PARTIAL} | MISSING: ${counts.MISSING}\n`,
  );

  for (const row of rows) {
    console.log(`[${row.status}] ${row.requirement}`);
    console.log(`  Component: ${row.component}`);
    console.log(`  Path: ${row.filePath}`);
    console.log(`  Now: ${row.why}`);
    if (row.mustChange !== "None." && row.mustChange !== "None for v1.") {
      console.log(`  Change: ${row.mustChange}`);
    }
    console.log("");
  }
}
