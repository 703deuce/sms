/**
 * Test-gated enterprise readiness for Owner Amy.
 */
export type ReadinessLevel = "ENTERPRISE_READY" | "PARTIAL" | "MISSING" | "NOT_TESTED";

export type AuditRow = {
  requirement: string;
  component: string;
  filePath: string;
  status: ReadinessLevel;
  testLevel: "TOOL" | "AGENT" | "VOICE" | "MANUAL";
  why: string;
};

export const OWNER_AMY_AUDIT_MATRIX: AuditRow[] = [
  { requirement: "1. External session state", component: "owner-runtime/session", filePath: "platform/owner-runtime/", status: "PARTIAL", testLevel: "TOOL", why: "Session type exists; DB persistence not wired." },
  { requirement: "2. State-driven tool exposure", component: "OWNER_STATE_ALLOWED_TOOLS", filePath: "owner-runtime/states.ts", status: "PARTIAL", testLevel: "AGENT", why: "Guard exists; LLM loop not yet filtered." },
  { requirement: "3. Permission model", component: "owner-runtime/guard", filePath: "owner-runtime/guard.ts", status: "PARTIAL", testLevel: "AGENT", why: "publish/rollback permission checks in guard." },
  { requirement: "4. Structured change requests", component: "change-requests", filePath: "owner-runtime/change-requests.ts", status: "PARTIAL", testLevel: "TOOL", why: "Contract types exist; not yet sole write path." },
  { requirement: "5. No direct mutation", component: "PLATFORM_BLOCKED_TOOLS", filePath: "agent-runtime/gateway.ts", status: "PARTIAL", testLevel: "AGENT", why: "Blocked tools list; legacy control API still broad." },
  { requirement: "6. Truth rules (receipt-gated speech)", component: "constitution", filePath: "owner-runtime/constitution.ts", status: "PARTIAL", testLevel: "AGENT", why: "Constitution written; LLM compliance not tested." },
  { requirement: "7. Confirmation policy", component: "owner-confirmation", filePath: "intelligence/owner-confirmation.ts", status: "PARTIAL", testLevel: "VOICE", why: "Existing confirmation gate; runtime integration partial." },
  { requirement: "8. Diagnostic tools (structured)", component: "owner-tool-executor", filePath: "intelligence/owner-tool-executor.ts", status: "PARTIAL", testLevel: "AGENT", why: "Read tools exist; trace reconstruction not automated." },
  { requirement: "9. Architect contract (structured)", component: "ArchitectBuildRequest", filePath: "owner-runtime/change-requests.ts", status: "ENTERPRISE_READY", testLevel: "TOOL", why: "Structured contract types pass unit tests." },
  { requirement: "10. Audit trail / receipts", component: "agent-runtime/receipts", filePath: "platform/agent-runtime/", status: "PARTIAL", testLevel: "TOOL", why: "Receipt types exist; not persisted to audit log yet." },
  { requirement: "11. Publish without tests blocked", component: "owner-runtime/guard", filePath: "owner-runtime/guard.ts", status: "ENTERPRISE_READY", testLevel: "AGENT", why: "Guard blocks publish when tests_passed=false." },
  { requirement: "12. Tenant isolation", component: "gateway", filePath: "agent-runtime/gateway.ts", status: "PARTIAL", testLevel: "VOICE", why: "Context carries tenant_id; live isolation test pending." },
  { requirement: "13. Thin permanent prompt", component: "constitution", filePath: "owner-runtime/constitution.ts", status: "ENTERPRISE_READY", testLevel: "MANUAL", why: "Constitution module exists." },
  { requirement: "14. Enterprise gate scenario", component: "test-owner-amy-runtime", filePath: "scripts/", status: "MISSING", testLevel: "VOICE", why: "Full diagnose→change→publish gate not automated." },
];

export function printOwnerAmyAuditMatrix(rows: AuditRow[] = OWNER_AMY_AUDIT_MATRIX): void {
  const counts = { ENTERPRISE_READY: 0, PARTIAL: 0, MISSING: 0, NOT_TESTED: 0 };
  for (const row of rows) counts[row.status]++;
  console.log("\n=== Owner Amy Enterprise Readiness (TEST-GATED) ===\n");
  console.log(`READY: ${counts.ENTERPRISE_READY} | PARTIAL: ${counts.PARTIAL} | MISSING: ${counts.MISSING}\n`);
  for (const row of rows) {
    console.log(`[${row.status}] [${row.testLevel}] ${row.requirement}`);
    console.log(`  ${row.component} — ${row.why}\n`);
  }
}
