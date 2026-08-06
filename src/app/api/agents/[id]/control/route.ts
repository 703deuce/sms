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
  "activate_agent_version",
  "rollback_agent_version",
  "duplicate_agent",
  "save_business_brain",
  "approve_knowledge_facts",
  "attach_missed_call_text_back",
  "get_missed_call_handoff",
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
