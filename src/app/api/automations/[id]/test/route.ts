import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getFlowDeploymentDiagnostics } from "@/lib/automations/deployment-diagnostics";
import { enrollInAutomation } from "@/lib/automations/enroll";
import {
  validateAutomationForPublish,
  hasBlockingErrors,
} from "@/lib/automations/validation";
import { parseAutomationDefinition } from "@/lib/automations/types";

type CheckStatus = "pass" | "fail" | "not_verified";

type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string | null;
};

/**
 * Real appointment-booking workflow test.
 * Never marks unverified checks as Passed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      contactId?: string;
      callId?: string;
      mode?: "validate" | "enroll" | "verify_call";
    };

    const prisma = getPrisma();
    const flow = await prisma.automationFlow.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const def = parseAutomationDefinition(
      flow.publishedDefinition ?? flow.definition,
    );
    const issues = validateAutomationForPublish(flow.name, def);
    const diagnostics = await getFlowDeploymentDiagnostics(
      auth.workspaceId,
      id,
    );

    const checks: Check[] = [
      {
        id: "workflow_valid",
        label: "Workflow validates",
        status: hasBlockingErrors(issues) ? "fail" : "pass",
        detail: hasBlockingErrors(issues)
          ? issues.map((i) => i.message).join("; ")
          : null,
      },
      {
        id: "phone_number",
        label: "Correct phone number configured",
        status: diagnostics?.readiness.triggerConfigured
          ? "pass"
          : diagnostics?.readiness.phoneNumberRequired
            ? "fail"
            : "not_verified",
        detail: diagnostics?.phoneE164 || "Phone number required",
      },
      {
        id: "assistant",
        label: "Correct assistant configured",
        status: diagnostics?.readiness.assistantReady ? "pass" : "fail",
        detail: diagnostics?.telnyxAssistantId || "Telnyx assistant missing",
      },
      {
        id: "deployment",
        label: "TriggerDeployment recorded",
        status:
          diagnostics?.deploymentStatus === "live" ||
          diagnostics?.deploymentStatus === "test"
            ? "pass"
            : diagnostics?.deploymentStatus === "error"
              ? "fail"
              : "not_verified",
        detail: diagnostics?.deploymentStatus || "Not activated",
      },
      {
        id: "trigger_fired",
        label: "Trigger fired",
        status: "not_verified",
        detail: "Place a real call to the assigned number",
      },
      {
        id: "assistant_launched",
        label: "Correct assistant launched",
        status: "not_verified",
        detail: "Confirm Maya answered via Telnyx direct routing",
      },
      {
        id: "first_audio",
        label: "First assistant audio received",
        status: "not_verified",
        detail: "Listen for greeting on the PSTN call",
      },
      {
        id: "booking_tool",
        label: "Booking tool invoked",
        status: "not_verified",
        detail: "Complete a booking during the call",
      },
      {
        id: "booking_persisted",
        label: "Booking persisted",
        status: "not_verified",
        detail: "Confirm calendar / VoiceAppointment row",
      },
      {
        id: "workflow_resumed",
        label: "Workflow resumed after call",
        status: "not_verified",
        detail: "Requires call completion webhook",
      },
      {
        id: "branch_executed",
        label: "Expected branch executed",
        status: "not_verified",
        detail: "Requires Call Outcome node evaluation",
      },
    ];

    let executionId: string | null = null;

    // Optional: dry-run enroll (does not prove live audio path).
    if (body.mode === "enroll" && body.contactId) {
      const result = await enrollInAutomation({
        workspaceId: auth.workspaceId,
        flowId: id,
        contactId: body.contactId,
        testMode: true,
        variables: {
          testScenario: "appointment_booking",
          callId: body.callId || null,
        },
      });
      executionId = result.execution?.id || null;
      checks.push({
        id: "test_enroll",
        label: "Test enrollment created",
        status: executionId ? "pass" : "fail",
        detail: executionId || result.reason || "enroll failed",
      });
    }

    // If a real callId is provided, verify correlation facts.
    if (body.callId) {
      const call = await prisma.voiceCall.findFirst({
        where: { id: body.callId, workspaceId: auth.workspaceId },
        include: {
          toolExecutions: { take: 20, include: { tool: { select: { name: true } } } },
          appointments: { take: 5 },
          transcripts: { take: 1 },
        },
      });
      if (!call) {
        checks.push({
          id: "call_lookup",
          label: "Call found",
          status: "fail",
          detail: "callId not found in workspace",
        });
      } else {
        const set = (cid: string, status: CheckStatus, detail?: string) => {
          const row = checks.find((c) => c.id === cid);
          if (row) {
            row.status = status;
            row.detail = detail || row.detail;
          }
        };
        set(
          "trigger_fired",
          call.direction === "INBOUND" ? "pass" : "not_verified",
          `call=${call.id} status=${call.status}`,
        );
        set(
          "phone_number",
          diagnostics?.phoneNumberId &&
            call.phoneNumberId === diagnostics.phoneNumberId
            ? "pass"
            : "fail",
          `call phone=${call.phoneNumberId || "none"} expected=${diagnostics?.phoneNumberId || "none"}`,
        );
        set(
          "assistant_launched",
          call.agentId && call.agentId === diagnostics?.agentId
            ? "pass"
            : "fail",
          `agent=${call.agentId || "none"}`,
        );
        set(
          "first_audio",
          call.answeredAt ? "pass" : "not_verified",
          call.answeredAt
            ? `answeredAt=${call.answeredAt.toISOString()}`
            : "No answeredAt yet",
        );
        const bookingTool = call.toolExecutions?.find(
          (t: {
            toolId?: string | null;
            tool?: { name?: string | null } | null;
          }) => {
            const name = String(t.tool?.name || t.toolId || "");
            return /book|appointment|calendar/i.test(name);
          },
        );
        set(
          "booking_tool",
          bookingTool ? "pass" : "not_verified",
          bookingTool
            ? `tool=${bookingTool.tool?.name || bookingTool.toolId}`
            : "No booking tool execution on call",
        );
        set(
          "booking_persisted",
          call.appointmentBooked || (call.appointments?.length || 0) > 0
            ? "pass"
            : "not_verified",
          call.appointmentBooked
            ? "appointmentBooked=true"
            : `${call.appointments?.length || 0} appointment rows`,
        );

        const exec = await prisma.automationExecution.findFirst({
          where: {
            workspaceId: auth.workspaceId,
            flowId: id,
            contactId: call.contactId || undefined,
          },
          orderBy: { startedAt: "desc" },
        });
        executionId = exec?.id || null;
        const meta = (exec?.metadata || {}) as Record<string, unknown>;
        set(
          "workflow_resumed",
          meta.callResult || meta.lastCallResultBranch
            ? "pass"
            : exec
              ? "not_verified"
              : "fail",
          exec
            ? `execution=${exec.id} status=${exec.status} branch=${String(meta.lastCallResultBranch || "")}`
            : "No workflow execution for this call/contact",
        );
        set(
          "branch_executed",
          meta.lastCallResultBranch ? "pass" : "not_verified",
          meta.lastCallResultBranch
            ? String(meta.lastCallResultBranch)
            : "Branch not recorded yet",
        );
      }
    }

    const passed = checks.filter((c) => c.status === "pass").length;
    const failed = checks.filter((c) => c.status === "fail").length;
    const unverified = checks.filter((c) => c.status === "not_verified").length;
    const overall =
      failed > 0 ? "fail" : unverified > 0 ? "incomplete" : "pass";

    return NextResponse.json({
      data: {
        overall,
        summary: { passed, failed, unverified, total: checks.length },
        checks,
        diagnostics,
        executionId,
        issues,
        note:
          "Live audio proof requires a real PSTN call. Unverified checks are Not verified — never auto-passed.",
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
