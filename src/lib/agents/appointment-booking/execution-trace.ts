/**
 * Unified execution trace across call + tools + workflow steps.
 */

import { getPrisma } from "@/lib/db";
import { diagnoseTrace } from "@/lib/agents/appointment-booking/intelligence/diagnostic-runtime";
import type { DiagnosticResult } from "@/lib/agents/appointment-booking/intelligence/types";
import type {
  AgentExecutionOutcome,
  AgentExecutionStep,
  AgentExecutionTrace,
} from "@/lib/agents/appointment-booking/types";

function sanitize(value: unknown): unknown {
  if (value == null) return value;
  const raw = JSON.stringify(value);
  const cleaned = raw
    .replace(
      /"(api[_-]?key|token|authorization|password|secret)"\s*:\s*"[^"]*"/gi,
      '"$1":"[redacted]"',
    )
    .slice(0, 4000);
  try {
    return JSON.parse(cleaned);
  } catch {
    return cleaned;
  }
}

function outcomeFromCall(call: {
  appointmentBooked?: boolean | null;
  transferred?: boolean | null;
  voicemailDetected?: boolean | null;
  outcome?: string | null;
  status?: string | null;
}): AgentExecutionOutcome {
  if (call.appointmentBooked) return "appointment_booked";
  if (call.transferred) return "transferred";
  if (call.voicemailDetected) return "message_taken";
  const o = String(call.outcome || "").toLowerCase();
  if (o.includes("book")) return "appointment_booked";
  if (o.includes("transfer")) return "transferred";
  if (o.includes("message") || o.includes("voicemail")) return "message_taken";
  if (o.includes("fail") || o.includes("error")) return "failed";
  if (o.includes("abandon") || o.includes("hang")) return "abandoned";
  if (String(call.status || "").toUpperCase() === "FAILED") return "failed";
  return "completed";
}

async function toolLabel(
  prisma: ReturnType<typeof getPrisma>,
  toolId: string | null | undefined,
): Promise<string> {
  if (!toolId) return "unknown_tool";
  const tool = await prisma.voiceTool.findFirst({
    where: { id: toolId },
    select: { name: true, toolType: true },
  });
  return String(tool?.toolType || tool?.name || toolId);
}

export async function buildExecutionTrace(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
}): Promise<AgentExecutionTrace | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: {
      id: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    },
  });
  if (!call) return null;

  const [tools, events] = await Promise.all([
    prisma.voiceToolExecution.findMany({
      where: { workspaceId: input.workspaceId, callId: call.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.voiceCallEvent.findMany({
      where: { workspaceId: input.workspaceId, callId: call.id },
      orderBy: { createdAt: "asc" },
      take: 40,
    }),
  ]);

  // Best-effort workflow steps via automation executions bound to this call.
  const executions = await prisma.automationExecution
    .findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { metadata: { path: ["pendingCallId"], equals: call.id } },
          { metadata: { path: ["variables", "callId"], equals: call.id } },
        ],
      },
      take: 5,
    })
    .catch(() => []);

  const executionIds = executions.map((e: { id: string }) => e.id);
  const steps = executionIds.length
    ? await prisma.automationStepExecution.findMany({
        where: { executionId: { in: executionIds } },
        take: 50,
      })
    : [];

  const out: AgentExecutionStep[] = [];
  let seq = 1;

  out.push({
    sequence: seq++,
    blockType: "inbound_call",
    startedAt: new Date(call.startedAt).toISOString(),
    completedAt: new Date(call.startedAt).toISOString(),
    status: "succeeded",
    sanitizedOutput: {
      from: call.fromE164,
      to: call.toE164,
      direction: call.direction,
    },
  });

  for (const ev of events) {
    out.push({
      sequence: seq++,
      blockType: `event:${ev.eventType}`,
      startedAt: new Date(ev.createdAt).toISOString(),
      completedAt: new Date(ev.createdAt).toISOString(),
      status: "succeeded",
    });
  }

  for (const step of steps) {
    const started = step.startedAt || step.completedAt;
    out.push({
      sequence: seq++,
      nodeId: step.nodeId || undefined,
      blockType: `workflow:${step.nodeId}`,
      startedAt: started
        ? new Date(started).toISOString()
        : new Date(call.startedAt).toISOString(),
      completedAt: step.completedAt
        ? new Date(step.completedAt).toISOString()
        : undefined,
      status:
        String(step.status).toLowerCase() === "failed"
          ? "failed"
          : String(step.status).toLowerCase() === "skipped"
            ? "skipped"
            : "succeeded",
      errorMessage: step.error || undefined,
      sanitizedOutput: sanitize(step.output),
    });
  }

  for (const tool of tools) {
    const name = await toolLabel(prisma, tool.toolId);
    const started = new Date(tool.createdAt);
    const latency = Number(tool.latencyMs || 0) || undefined;
    const failed = ["failed", "error"].includes(String(tool.status).toLowerCase());
    out.push({
      sequence: seq++,
      blockType: `tool:${name}`,
      startedAt: started.toISOString(),
      completedAt: tool.completedAt
        ? new Date(tool.completedAt).toISOString()
        : latency
          ? new Date(started.getTime() + latency).toISOString()
          : started.toISOString(),
      latencyMs: latency,
      status: failed ? "failed" : "succeeded",
      sanitizedInput: sanitize(tool.input),
      sanitizedOutput: sanitize(tool.output),
      errorMessage: tool.errorMessage || undefined,
    });
  }

  if (call.appointmentBooked) {
    out.push({
      sequence: seq++,
      blockType: "appointment_booked",
      startedAt: new Date(
        call.endedAt || call.updatedAt || call.startedAt,
      ).toISOString(),
      status: "succeeded",
    });
  }

  const outcome = outcomeFromCall(call);
  const failedTool = tools.find((t: { status: string }) =>
    ["failed", "error"].includes(String(t.status).toLowerCase()),
  );
  const summaryParts = [
    `Call ${call.id.slice(0, 8)}`,
    outcome.replaceAll("_", " "),
    tools.length ? `${tools.length} tool calls` : null,
    call.appointmentBooked ? "appointment booked" : null,
  ].filter(Boolean);

  return {
    executionId: `trace:${call.id}`,
    agentId: input.agentId,
    agentVersionId: call.agentVersionId || null,
    callId: call.id,
    startedAt: new Date(call.startedAt).toISOString(),
    completedAt: call.endedAt ? new Date(call.endedAt).toISOString() : null,
    steps: out,
    outcome,
    failureCode: failedTool ? String(failedTool.status) : null,
    callerPhone: call.fromE164,
    calledNumber: call.toE164,
    summary: summaryParts.join(" · "),
  };
}

export type AgentActivitySummary = {
  callId: string;
  summary: string;
  outcome: AgentExecutionOutcome;
  startedAt: string;
  completedAt?: string | null;
  callerPhone?: string | null;
  calledNumber?: string | null;
};

function buildCallSummary(call: {
  id: string;
  appointmentBooked?: boolean | null;
  transferred?: boolean | null;
  voicemailDetected?: boolean | null;
  outcome?: string | null;
  status?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
}): string {
  const shortId = call.id.slice(0, 8);
  const outcome = outcomeFromCall(call);
  const parts = [`Call ${shortId}`, outcome.replaceAll("_", " ")];
  if (call.appointmentBooked) parts.push("appointment booked");
  return parts.join(" · ");
}

/** Fast list for Activity tab — no per-call tool/event hydration. */
export async function listAgentActivitySummaries(input: {
  workspaceId: string;
  agentId: string;
  limit?: number;
  failuresOnly?: boolean;
}): Promise<AgentActivitySummary[]> {
  const prisma = getPrisma();
  const limit = Math.min(50, Math.max(1, Number(input.limit || 20)));
  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      ...(input.failuresOnly
        ? {
            OR: [{ status: "FAILED" }, { outcome: { contains: "fail" } }],
          }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      appointmentBooked: true,
      transferred: true,
      voicemailDetected: true,
      outcome: true,
      status: true,
      fromE164: true,
      toE164: true,
    },
  });

  return calls.map((call: (typeof calls)[number]) => ({
    callId: call.id,
    summary: buildCallSummary(call),
    outcome: outcomeFromCall(call),
    startedAt: new Date(call.startedAt).toISOString(),
    completedAt: call.endedAt ? new Date(call.endedAt).toISOString() : null,
    callerPhone: call.fromE164,
    calledNumber: call.toE164,
  }));
}

export function summarizeCallTraceForOwner(trace: AgentExecutionTrace): string {
  const when = new Date(trace.startedAt).toLocaleString();
  const parts = [
    `On ${when}, ${trace.summary.replace(/^Call \S+ · /, "")}.`,
    `Final outcome: ${trace.outcome.replaceAll("_", " ")}.`,
  ];

  const toolSteps = trace.steps.filter((s) => s.blockType.startsWith("tool:"));
  const bookStep = [...toolSteps]
    .reverse()
    .find((s) => {
      const input = s.sanitizedInput as { toolType?: string } | undefined;
      return input?.toolType === "book_appointment";
    });
  if (bookStep?.sanitizedOutput) {
    const out = bookStep.sanitizedOutput as Record<string, unknown>;
    if (out.startsAt) parts.push(`Booked slot: ${String(out.startsAt)}.`);
    if (out.appointmentId) parts.push(`Appointment id ${String(out.appointmentId)}.`);
    if (out.smsSent === true) parts.push("Confirmation SMS was sent.");
    if (out.alreadyBooked) parts.push("A duplicate book attempt was ignored (already confirmed).");
    if (out.provider) parts.push(`Calendar provider: ${String(out.provider)}.`);
  }

  const availStep = toolSteps.find((s) => {
    const input = s.sanitizedInput as { toolType?: string } | undefined;
    return input?.toolType === "calendar_availability";
  });
  if (availStep?.sanitizedOutput) {
    const out = availStep.sanitizedOutput as { provider?: string; slots?: unknown[] };
    if (out.provider) {
      parts.push(
        `Availability was checked via ${out.provider} (${Array.isArray(out.slots) ? out.slots.length : 0} slot(s) returned).`,
      );
    }
  }

  if (trace.callerPhone && trace.callerPhone !== "unknown") {
    parts.push(`Caller: ${trace.callerPhone}.`);
  }

  return parts.join(" ");
}

export async function searchAgentActivity(input: {
  workspaceId: string;
  agentId: string;
  limit?: number;
  failuresOnly?: boolean;
  summariesOnly?: boolean;
}): Promise<AgentExecutionTrace[]> {
  if (input.summariesOnly) {
    const summaries = await listAgentActivitySummaries(input);
    return summaries.map((s) => ({
      executionId: `trace:${s.callId}`,
      agentId: input.agentId,
      agentVersionId: null,
      callId: s.callId,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      steps: [],
      outcome: s.outcome,
      failureCode: null,
      callerPhone: s.callerPhone,
      calledNumber: s.calledNumber,
      summary: s.summary,
    }));
  }

  const prisma = getPrisma();
  const limit = Math.min(50, Math.max(1, Number(input.limit || 20)));
  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      ...(input.failuresOnly
        ? {
            OR: [{ status: "FAILED" }, { outcome: { contains: "fail" } }],
          }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  const traces: AgentExecutionTrace[] = [];
  for (const call of calls) {
    const trace = await buildExecutionTrace({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: call.id,
    });
    if (trace) traces.push(trace);
  }
  return traces;
}

export function explainTraceFailure(trace: AgentExecutionTrace): string {
  return diagnoseCallFailure(trace).ownerExplanation;
}

export function diagnoseCallFailure(trace: AgentExecutionTrace): DiagnosticResult {
  return diagnoseTrace(trace);
}

export function listToolNamesFromTrace(trace: AgentExecutionTrace): string[] {
  return trace.steps
    .filter((s) => s.blockType.startsWith("tool:"))
    .map((s) => s.blockType.replace(/^tool:/, ""));
}

/** Lightweight assertion helper — never pass merely because the call completed. */
export function assertTraceExpectations(
  trace: AgentExecutionTrace,
  expectedTools: string[],
): { passed: boolean; missing: string[]; failureReason: string | null } {
  const actual = new Set(listToolNamesFromTrace(trace));
  const missing = expectedTools.filter((t) => ![...actual].some((a) => a.includes(t) || t.includes(a)));
  if (missing.length) {
    return {
      passed: false,
      missing,
      failureReason: `Missing required tools: ${missing.join(", ")}`,
    };
  }
  if (
    expectedTools.some((t) => t.includes("book_appointment")) &&
    trace.outcome !== "appointment_booked"
  ) {
    return {
      passed: false,
      missing: [],
      failureReason: `Expected appointment_booked outcome, got ${trace.outcome}`,
    };
  }
  return { passed: true, missing: [], failureReason: null };
}
