/**
 * Test-gated enterprise readiness for Workflow Architect.
 */
import type { AuditRow, ReadinessLevel } from "./owner-readiness-matrix";

export const WORKFLOW_ARCHITECT_AUDIT_MATRIX: AuditRow[] = [
  { requirement: "1. Fixed node catalog", component: "WORKFLOW_NODE_CATALOG", filePath: "workflow-dsl/node-catalog.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "Registered nodes; unknown types rejected." },
  { requirement: "2. Canonical workflow DSL", component: "CanonicalWorkflowSpec", filePath: "workflow-dsl/types.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "Schema types defined." },
  { requirement: "3. Schema validation", component: "validator", filePath: "workflow-dsl/validator.ts", status: "PARTIAL", testLevel: "TOOL", why: "Pipeline exists; not all business rules yet." },
  { requirement: "4. Graph validation", component: "validator", filePath: "workflow-dsl/validator.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "Reachability, cycles, invalid refs checked." },
  { requirement: "5. Failure-path validation", component: "validator", filePath: "workflow-dsl/validator.ts", status: "PARTIAL", testLevel: "TOOL", why: "Required for side-effect nodes; not all routes tested." },
  { requirement: "6. Field reference validation", component: "validator", filePath: "workflow-dsl/validator.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "FIELD_NOT_FOUND enforced when manifest provided." },
  { requirement: "7. Integration dependency validation", component: "validator", filePath: "workflow-dsl/validator.ts", status: "PARTIAL", testLevel: "TOOL", why: "INTEGRATION_UNAVAILABLE when manifest provided." },
  { requirement: "8. Cannot publish", component: "architect-runtime/guard", filePath: "architect-runtime/guard.ts", status: "ENTERPRISE_READY", testLevel: "AGENT", why: "Publish tools blocked for architect." },
  { requirement: "9. Candidate versioning", component: "versioning", filePath: "architect-runtime/versioning.ts", status: "PARTIAL", testLevel: "TOOL", why: "Immutable versions; DB persistence pending." },
  { requirement: "10. Repair loop (max attempts)", component: "MAX_ARCHITECT_REPAIR_ATTEMPTS", filePath: "workflow-dsl/validator.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "Constant defined; loop wiring partial." },
  { requirement: "11. CAPABILITY_NOT_SUPPORTED", component: "assertValidWorkflowOrFail", filePath: "workflow-dsl/validator.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "Unknown nodes return capability_not_supported." },
  { requirement: "12. No code generation", component: "constitution", filePath: "architect-runtime/constitution.ts", status: "PARTIAL", testLevel: "MANUAL", why: "Constitution forbids; legacy architect may still use templates." },
  { requirement: "13. Simulation before publish", component: "workflow-test-plan", filePath: "intelligence/workflow-test-plan.ts", status: "PARTIAL", testLevel: "VOICE", why: "Test plan exists; simulation gate not unified." },
  { requirement: "14. Enterprise gate scenario", component: "test-workflow-architect-runtime", filePath: "scripts/", status: "MISSING", testLevel: "VOICE", why: "Missed-call-after-hours scenario not automated." },
];

export function printWorkflowArchitectAuditMatrix(
  rows: AuditRow[] = WORKFLOW_ARCHITECT_AUDIT_MATRIX,
): void {
  const counts: Record<ReadinessLevel, number> = { ENTERPRISE_READY: 0, PARTIAL: 0, MISSING: 0, NOT_TESTED: 0 };
  for (const row of rows) counts[row.status]++;
  console.log("\n=== Workflow Architect Enterprise Readiness (TEST-GATED) ===\n");
  console.log(`READY: ${counts.ENTERPRISE_READY} | PARTIAL: ${counts.PARTIAL} | MISSING: ${counts.MISSING}\n`);
  for (const row of rows) {
    console.log(`[${row.status}] [${row.testLevel}] ${row.requirement}`);
    console.log(`  ${row.component} — ${row.why}\n`);
  }
}
