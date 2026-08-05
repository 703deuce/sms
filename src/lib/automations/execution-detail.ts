/**
 * Execution = one run of a workflow template.
 *
 * Layers:
 *   Phone Number → Inbound Call Trigger → Workflow → Execution → Voice Agent
 *
 * The workflow is the template. The execution is the debuggable instance:
 * status, current node, bound call, variables, step path, outcomes.
 */

import { getPrisma } from "@/lib/db";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { formatPhone } from "@/lib/utils";

export type ExecutionStepView = {
  nodeId: string;
  label: string;
  blockType: string | null;
  status: string;
  branchTaken: string | null;
  error: string | null;
  output: unknown;
  startedAt: string | null;
  completedAt: string | null;
};

export type ExecutionCallView = {
  callId: string;
  status: string;
  direction: string;
  answered: boolean;
  appointmentBooked: boolean;
  transferred: boolean;
  voicemailDetected: boolean;
  durationSeconds: number | null;
  outcome: string | null;
  fromE164: string;
  toE164: string;
  agentId: string | null;
  agentName: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  transcriptPreview: string | null;
  transcriptId: string | null;
  recordingId: string | null;
  toolCalls: Array<{
    id: string;
    toolName: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
  appointments: Array<{
    id: string;
    serviceName: string | null;
    startsAt: string;
  }>;
};

export type ExecutionOutcomeSummary = {
  booked: boolean | null;
  calendarCreated: boolean | null;
  branch: string | null;
  answered: boolean | null;
  durationLabel: string | null;
  smsSent: boolean | null;
  transferCompleted: boolean | null;
  callerHungUp: boolean | null;
};

export type ExecutionDetailView = {
  id: string;
  shortId: string;
  flowId: string;
  flowName: string;
  flowVersion: number;
  status: string;
  statusLabel: string;
  testMode: boolean;
  phone: string | null;
  phoneDisplay: string | null;
  contactId: string | null;
  contactName: string | null;
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  error: string | null;
  currentNodeId: string | null;
  currentNodeLabel: string | null;
  currentBlockType: string | null;
  variables: Record<string, unknown>;
  metadata: Record<string, unknown>;
  call: ExecutionCallView | null;
  callStatusLabel: string | null;
  outcome: ExecutionOutcomeSummary;
  path: ExecutionStepView[];
  logs: Array<{ at: string; level: string; message: string }>;
};

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function statusLabel(status: string): string {
  switch (status) {
    case "RUNNING":
      return "Running";
    case "WAITING":
      return "Waiting";
    case "COMPLETED":
      return "Complete";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    case "PAUSED":
      return "Paused";
    default:
      return status;
  }
}

function durationLabel(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m <= 0) return `${rem}s`;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}

function callStatusLabel(call: ExecutionCallView | null, meta: Record<string, unknown>): string | null {
  if (!call) {
    if (meta.inboundAttach) return "Awaiting call bind";
    if (meta.pendingCallId) return "Call pending";
    return null;
  }
  if (call.endedAt) return "Ended";
  if (call.answered) return "Connected";
  if (call.status === "RINGING") return "Ringing";
  return call.status;
}

export async function loadExecutionDetail(
  workspaceId: string,
  flowId: string,
  executionId: string,
): Promise<ExecutionDetailView | null> {
  const prisma = getPrisma();
  const execution = await prisma.automationExecution.findFirst({
    where: { id: executionId, flowId, workspaceId },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      flow: {
        select: {
          id: true,
          name: true,
          definition: true,
          publishedDefinition: true,
        },
      },
      steps: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!execution) return null;

  const meta = (execution.metadata || {}) as Record<string, unknown>;
  const variables =
    meta.variables && typeof meta.variables === "object"
      ? (meta.variables as Record<string, unknown>)
      : {};

  const def = parseAutomationDefinition(
    execution.flow.publishedDefinition ?? execution.flow.definition,
  );
  const nodeById = new Map(def.nodes.map((n) => [n.id, n]));

  const currentNode = execution.currentNodeId
    ? nodeById.get(execution.currentNodeId)
    : null;

  const pendingCallId =
    (typeof meta.pendingCallId === "string" && meta.pendingCallId) ||
    (typeof variables.callId === "string" && variables.callId) ||
    (meta.callResult &&
    typeof meta.callResult === "object" &&
    typeof (meta.callResult as { callId?: unknown }).callId === "string"
      ? (meta.callResult as { callId: string }).callId
      : null);

  let callView: ExecutionCallView | null = null;
  if (pendingCallId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: pendingCallId, workspaceId },
      include: {
        agent: { select: { id: true, name: true, displayName: true } },
        transcripts: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, fullText: true },
        },
        recordings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
        toolExecutions: {
          orderBy: { createdAt: "asc" },
          take: 40,
          include: { tool: { select: { name: true } } },
        },
        appointments: {
          orderBy: { startsAt: "asc" },
          take: 10,
          select: { id: true, serviceName: true, startsAt: true },
        },
      },
    });
    if (call) {
      const transcript = call.transcripts[0];
      callView = {
        callId: call.id,
        status: call.status,
        direction: call.direction,
        answered: Boolean(call.answeredAt),
        appointmentBooked: Boolean(call.appointmentBooked),
        transferred: Boolean(call.transferred),
        voicemailDetected: Boolean(call.voicemailDetected),
        durationSeconds: call.durationSeconds,
        outcome: call.outcome,
        fromE164: call.fromE164,
        toE164: call.toE164,
        agentId: call.agentId,
        agentName: call.agent?.displayName || call.agent?.name || null,
        answeredAt: call.answeredAt?.toISOString() || null,
        endedAt: call.endedAt?.toISOString() || null,
        transcriptPreview: transcript?.fullText
          ? String(transcript.fullText).slice(0, 500)
          : null,
        transcriptId: transcript?.id || null,
        recordingId: call.recordings[0]?.id || null,
        toolCalls: call.toolExecutions.map(
          (t: {
            id: string;
            toolId: string | null;
            status: string;
            errorMessage: string | null;
            createdAt: Date;
            tool?: { name?: string | null } | null;
          }) => ({
            id: t.id,
            toolName: t.tool?.name || t.toolId || null,
            status: t.status,
            errorMessage: t.errorMessage,
            createdAt: t.createdAt.toISOString(),
          }),
        ),
        appointments: call.appointments.map(
          (a: {
            id: string;
            serviceName: string | null;
            startsAt: Date;
          }) => ({
            id: a.id,
            serviceName: a.serviceName,
            startsAt: a.startsAt.toISOString(),
          }),
        ),
      };
    }
  }

  const path: ExecutionStepView[] = execution.steps.map(
    (s: {
      nodeId: string;
      status: string;
      branchTaken: string | null;
      error: string | null;
      output: unknown;
      startedAt: Date | null;
      completedAt: Date | null;
    }) => {
    const node = nodeById.get(s.nodeId);
    return {
      nodeId: s.nodeId,
      label: node?.data.label || s.nodeId,
      blockType: node?.data.blockType || null,
      status: s.status,
      branchTaken: s.branchTaken,
      error: s.error,
      output: s.output,
      startedAt: s.startedAt?.toISOString() || null,
      completedAt: s.completedAt?.toISOString() || null,
    };
  },
  );

  const callResult =
    meta.callResult && typeof meta.callResult === "object"
      ? (meta.callResult as Record<string, unknown>)
      : null;
  const branch =
    (typeof meta.lastCallResultBranch === "string" &&
      meta.lastCallResultBranch) ||
    null;

  const smsStepDone = path.some(
    (p) =>
      (p.blockType === "send_sms" || p.blockType === "send_review_request") &&
      p.status === "completed",
  );

  const outcome: ExecutionOutcomeSummary = {
    booked:
      callView?.appointmentBooked ??
      (callResult?.appointmentBooked === true
        ? true
        : branch === "booked"
          ? true
          : callResult
            ? false
            : null),
    calendarCreated:
      callView && callView.appointments.length > 0
        ? true
        : callView
          ? false
          : null,
    branch,
    answered: callView ? callView.answered : null,
    durationLabel: durationLabel(callView?.durationSeconds),
    smsSent: smsStepDone ? true : path.some((p) => p.blockType === "send_sms") ? false : null,
    transferCompleted: callView ? callView.transferred : null,
    callerHungUp:
      callResult?.callerHungUp === true
        ? true
        : callView?.outcome?.toLowerCase().includes("hang")
          ? true
          : null,
  };

  const logs: ExecutionDetailView["logs"] = [];
  logs.push({
    at: execution.startedAt.toISOString(),
    level: "info",
    message: `Execution ${shortId(execution.id)} started`,
  });
  for (const step of path) {
    if (step.startedAt) {
      logs.push({
        at: step.startedAt,
        level: "info",
        message: `Entered ${step.label}${step.blockType ? ` (${step.blockType})` : ""}`,
      });
    }
    if (step.branchTaken) {
      logs.push({
        at: step.completedAt || step.startedAt || execution.startedAt.toISOString(),
        level: "info",
        message: `Branch: ${step.branchTaken}`,
      });
    }
    if (step.error) {
      logs.push({
        at: step.completedAt || step.startedAt || execution.startedAt.toISOString(),
        level: "error",
        message: `${step.label}: ${step.error}`,
      });
    }
  }
  if (callView) {
    logs.push({
      at: callView.answeredAt || execution.startedAt.toISOString(),
      level: "info",
      message: `Call ${callView.callId} ${callView.answered ? "connected" : callView.status}`,
    });
    for (const tool of callView.toolCalls) {
      logs.push({
        at: tool.createdAt,
        level: tool.errorMessage ? "error" : "info",
        message: `Tool ${tool.toolName || "unknown"}: ${tool.status}${
          tool.errorMessage ? ` — ${tool.errorMessage}` : ""
        }`,
      });
    }
  }
  if (execution.completedAt) {
    logs.push({
      at: execution.completedAt.toISOString(),
      level: execution.status === "FAILED" ? "error" : "info",
      message: `Execution ${statusLabel(execution.status)}${
        execution.error ? `: ${execution.error}` : ""
      }`,
    });
  }

  const phone = execution.contact?.phone || callView?.fromE164 || null;

  return {
    id: execution.id,
    shortId: shortId(execution.id),
    flowId: execution.flowId,
    flowName: execution.flow.name,
    flowVersion: execution.flowVersion,
    status: execution.status,
    statusLabel: statusLabel(execution.status),
    testMode: meta.testMode === true,
    phone,
    phoneDisplay: phone ? formatPhone(phone) : null,
    contactId: execution.contactId,
    contactName: execution.contact
      ? [execution.contact.firstName, execution.contact.lastName]
          .filter(Boolean)
          .join(" ") || null
      : null,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt?.toISOString() || null,
    failedAt: execution.failedAt?.toISOString() || null,
    error: execution.error,
    currentNodeId: execution.currentNodeId,
    currentNodeLabel: currentNode?.data.label || execution.currentNodeId,
    currentBlockType: currentNode?.data.blockType || null,
    variables,
    metadata: meta,
    call: callView,
    callStatusLabel: callStatusLabel(callView, meta),
    outcome,
    path,
    logs: logs.sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export async function listExecutionSummaries(
  workspaceId: string,
  flowId: string,
  take = 50,
) {
  const prisma = getPrisma();
  const flow = await prisma.automationFlow.findFirst({
    where: { id: flowId, workspaceId },
    select: { definition: true, publishedDefinition: true, name: true },
  });
  if (!flow) return [];

  const def = parseAutomationDefinition(
    flow.publishedDefinition ?? flow.definition,
  );
  const nodeById = new Map(def.nodes.map((n) => [n.id, n]));

  const executions = await prisma.automationExecution.findMany({
    where: { flowId, workspaceId },
    orderBy: { startedAt: "desc" },
    take,
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      steps: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { branchTaken: true, nodeId: true },
      },
    },
  });

  return executions.map(
    (ex: {
      id: string;
      status: string;
      contact: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        phone: string;
      } | null;
      startedAt: Date;
      completedAt: Date | null;
      error: string | null;
      currentNodeId: string | null;
      metadata: unknown;
      steps: Array<{ branchTaken: string | null; nodeId: string }>;
    }) => {
    const meta = (ex.metadata || {}) as Record<string, unknown>;
    const current = ex.currentNodeId
      ? nodeById.get(ex.currentNodeId)
      : null;
    const lastBranch =
      (typeof meta.lastCallResultBranch === "string" &&
        meta.lastCallResultBranch) ||
      ex.steps[0]?.branchTaken ||
      null;
    return {
      id: ex.id,
      shortId: shortId(ex.id),
      status: ex.status,
      statusLabel: statusLabel(ex.status),
      phone: ex.contact?.phone || null,
      phoneDisplay: ex.contact?.phone
        ? formatPhone(ex.contact.phone)
        : null,
      contactName: ex.contact
        ? [ex.contact.firstName, ex.contact.lastName]
            .filter(Boolean)
            .join(" ") || null
        : null,
      startedAt: ex.startedAt.toISOString(),
      completedAt: ex.completedAt?.toISOString() || null,
      error: ex.error,
      currentNodeId: ex.currentNodeId,
      currentNodeLabel: current?.data.label || ex.currentNodeId,
      pendingCallId:
        typeof meta.pendingCallId === "string" ? meta.pendingCallId : null,
      branch: lastBranch,
      testMode: meta.testMode === true,
      inboundAttach: meta.inboundAttach === true,
      href: `/automations/${flowId}/executions/${ex.id}`,
    };
  },
  );
}
