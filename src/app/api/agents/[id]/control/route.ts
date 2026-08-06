import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { runAgentControlCommand } from "@/lib/agents/appointment-booking/control";
import type { AgentControlCommand } from "@/lib/agents/appointment-booking/types";

const COMMANDS = new Set<AgentControlCommand>([
  "get_agent_summary",
  "get_agent_configuration",
  "get_agent_health",
  "get_agent_metrics",
  "search_agent_activity",
  "get_call_details",
  "explain_call_failure",
  "get_execution_trace",
  "get_employee_timeline",
  "list_versions",
  "pause_agent",
  "resume_agent",
  "owner_ask",
  "create_change_proposal",
  "list_change_proposals",
  "confirm_change_proposal",
  "reject_change_proposal",
  "create_workflow_draft",
  "validate_workflow_draft",
  "list_workflow_drafts",
  "promote_workflow_draft",
  "run_agent_test_snapshot",
  "run_agent_test_suite",
  "run_agent_simulation",
  "get_agent_responsibility",
  "get_daily_report",
  "get_exception_alerts",
  "get_attention_inbox",
  "get_memory_view",
  "get_live_readiness",
  "get_autonomy_policy",
  "teach_agent",
  "set_autonomy_budget",
  "pause_capability",
  "resume_capability",
  "run_safe_auto_repair",
  "create_agent_handoff",
  "list_agent_handoffs",
  "activate_agent_version",
  "rollback_agent_version",
  "duplicate_agent",
  "save_business_brain",
  "approve_knowledge_facts",
  "attach_missed_call_text_back",
  "get_missed_call_handoff",
  "get_booking_verification",
  "propose_setup_change",
  "get_setup_readiness",
  "run_setup_command",
  "get_deployment_drift",
  "get_runtime_registry",
  "get_field_ownership_report",
  "list_agent_appointments",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      command?: string;
      payload?: Record<string, unknown>;
    };
    const command = String(body.command || "").trim() as AgentControlCommand;
    if (!COMMANDS.has(command)) {
      return NextResponse.json(
        { error: `Unknown command. Allowed: ${[...COMMANDS].join(", ")}` },
        { status: 400 },
      );
    }
    const data = await runAgentControlCommand({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      agentId: id,
      command,
      payload: body.payload || {},
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
