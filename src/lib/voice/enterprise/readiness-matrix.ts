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
    component: "Workflow tool guard",
    filePath: "src/lib/voice/workflow-engine/guard.ts",
    status: "PARTIAL",
    why: "Server-side assertToolAllowed enforces state-scoped tools; Telnyx still receives full catalog at sync.",
    mustChange: "Filter assistant tools by workflow template at publish; keep server guard as backstop.",
  },
  {
    requirement: "2. Workflow engine with states + transitions",
    component: "Workflow engine v1",
    filePath: "src/lib/voice/workflow-engine/",
    status: "PARTIAL",
    why: "States, transitions, and recompute exist on VoiceCall.metadata.agentRuntime.",
    mustChange: "Wire AutomationFlow blocks to live interpreter; add explicit intent detection.",
  },
  {
    requirement: "3. Dynamic tool exposure by state",
    component: "STATE_ALLOWED_TOOLS + runtime context",
    filePath: "src/lib/voice/workflow-engine/states.ts",
    status: "PARTIAL",
    why: "allowed_tools injected via dynamic variables; enforcement at tool webhook.",
    mustChange: "Per-turn Telnyx tool refresh or compile-time tool subsets per workflow branch.",
  },
  {
    requirement: "4. Separate prompt layers",
    component: "Modular prompts + runtime injection",
    filePath: "src/lib/agents/appointment-booking/intelligence/prompt-modules.ts",
    status: "PARTIAL",
    why: "Constitution modules + dynamic variables; playbook still in prompt.",
    mustChange: "Slim tool_policy to behavior-only; move tool schemas to runtime context only.",
  },
  {
    requirement: "5. Professional tool descriptions",
    component: "Caller tool playbook",
    filePath: "src/lib/agents/appointment-booking/intelligence/caller-tool-playbook.ts",
    status: "PARTIAL",
    why: "whenToCall/never/parameters documented for core tools.",
    mustChange: "Add USE ONLY / DO NOT USE / SUCCESS blocks for all scheduling tools.",
  },
  {
    requirement: "6. Strict structured schemas",
    component: "Tool catalog webhook bodies",
    filePath: "src/lib/voice/tools/catalog.ts",
    status: "PARTIAL",
    why: "JSON schemas defined; strict mode not verified with Telnyx provider.",
    mustChange: "Enable strict structured outputs where Telnyx/Anthropic support it.",
  },
  {
    requirement: "7. Config-driven field IDs",
    component: "Field runtime",
    filePath: "src/lib/voice/field-runtime/",
    status: "ENTERPRISE_READY",
    why: "Builder fields with stable field_id; legacy shim only.",
    mustChange: "Remove save_caller_info from default enabled tools after migration window.",
  },
  {
    requirement: "8. record_current_field(value)",
    component: "Minimal field collection",
    filePath: "src/lib/voice/field-runtime/save.ts",
    status: "ENTERPRISE_READY",
    why: "Active field resolved from workflow state; Amy passes value only.",
    mustChange: "None for v1.",
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
    component: "agentRuntime + workflowFieldSession",
    filePath: "src/lib/voice/workflow-engine/runtime-state.ts",
    status: "PARTIAL",
    why: "Dual metadata keys hold state; survives context loss.",
    mustChange: "Consolidate customerCollectedState/bookingConversationState; optional dedicated table.",
  },
  {
    requirement: "11. Idempotent operations + receipts",
    component: "Booking gateway + operation receipts",
    filePath: "src/lib/voice/agent-tool-gateway/booking-workflow.ts",
    status: "PARTIAL",
    why: "operation_id idempotency for book; field receipts on record_current_field.",
    mustChange: "Unified receipt store for all side-effecting tools.",
  },
  {
    requirement: "12. No verbal success before confirmed result",
    component: "Gateway envelope + prompts",
    filePath: "src/lib/voice/agent-tool-gateway/envelope.ts",
    status: "PARTIAL",
    why: "may_confirm_to_caller flag; prompt rules exist.",
    mustChange: "Automated evals for premature confirmation phrases.",
  },
  {
    requirement: "13. Async secondary work",
    component: "Calendly provider sync job",
    filePath: "src/lib/voice/agent-tool-gateway/provider-sync.ts",
    status: "PARTIAL",
    why: "Calendly sync async; CRM/notifications partially sync.",
    mustChange: "Outbox pattern for all non-critical post-call work.",
  },
  {
    requirement: "14. Machine-readable errors",
    component: "Agent tool gateway errors",
    filePath: "src/lib/voice/agent-tool-gateway/errors.ts",
    status: "ENTERPRISE_READY",
    why: "error_code, retryable, next_action in envelope.",
    mustChange: "Extend to all builtin tools beyond scheduling.",
  },
  {
    requirement: "15. No interrupt during destructive writes",
    component: "BOOKING_IN_PROGRESS guard",
    filePath: "src/lib/voice/workflow-engine/guard.ts",
    status: "PARTIAL",
    why: "pending_operations blocks other tools during book.",
    mustChange: "Telnyx-level barge-in policy for write tools.",
  },
  {
    requirement: "16. Provider adapters behind domain interfaces",
    component: "Calendly voice + gateway",
    filePath: "src/lib/voice/calendar/",
    status: "PARTIAL",
    why: "Local-first booking with async Calendly sync.",
    mustChange: "Common SchedulingProvider interface for Google/Calendly/GHL.",
  },
  {
    requirement: "17. Tool contract tests",
    component: "Gateway + field runtime scripts",
    filePath: "scripts/test-agent-tool-gateway.ts",
    status: "PARTIAL",
    why: "Unit scripts exist; no DB integration for field save chain.",
    mustChange: "Add integration tests with test DB.",
  },
  {
    requirement: "18. Generated arbitrary field tests",
    component: "Field mutation tests",
    filePath: "scripts/test-field-runtime-mutations.ts",
    status: "PARTIAL",
    why: "Mutation generator added in this PR.",
    mustChange: "Run in CI with hundreds of permutations.",
  },
  {
    requirement: "19. Failure injection tests",
    component: "Provider failure simulation",
    filePath: "scripts/",
    status: "MISSING",
    why: "No automated timeout/409/401 injection suite.",
    mustChange: "Add failure injection harness for gateway.",
  },
  {
    requirement: "20. Tracing / reconstructability",
    component: "VoiceToolExecution + execution trace",
    filePath: "src/lib/agents/appointment-booking/execution-trace.ts",
    status: "PARTIAL",
    why: "Tool executions logged; state_history on agentRuntime.",
    mustChange: "Unified trace UI with workflow state timeline.",
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
    console.log(`  Change: ${row.mustChange}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  printAuditMatrix();
}
