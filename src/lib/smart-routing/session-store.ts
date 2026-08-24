import { createHash, randomUUID } from "crypto";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { emitSmartRoutingEvent } from "./events";
import type { DraftConfig, SessionState } from "./types";

export async function createNodeExecution(input: {
  callSessionId: string;
  nodeId: string;
  nodeType: string;
  status?: string;
  result?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  return prisma.smartRoutingNodeExecution.create({
    data: {
      callSessionId: input.callSessionId,
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      status: input.status ?? "started",
      resultJson: (input.result ?? {}) as object,
    },
  });
}

export async function completeNodeExecution(
  executionId: string,
  result?: Record<string, unknown>,
  status = "completed",
) {
  const prisma = getPrisma();
  await prisma.smartRoutingNodeExecution.update({
    where: { id: executionId },
    data: {
      completedAt: new Date(),
      status,
      resultJson: (result ?? {}) as object,
    },
  });
}

export async function loadCallSession(sessionId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingCallSession.findUnique({
    where: { id: sessionId },
    include: { flow: true },
  });
}

export async function loadPublishedCompiledFlow(flowId: string) {
  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findUnique({ where: { id: flowId } });
  if (!flow?.publishedVersionId) return null;
  const version = await prisma.smartRoutingFlowVersion.findUnique({
    where: { id: flow.publishedVersionId },
  });
  if (!version) return null;
  return {
    flow,
    version,
    compiled: version.compiledJson as Record<string, unknown>,
  };
}

export async function updateSessionState(
  sessionId: string,
  patch: Partial<{
    currentNodeId: string | null;
    stateJson: SessionState;
    finalOutcome: string;
    completedAt: Date;
    answeredAt: Date;
    menuSelection: string;
    smsTriggered: boolean;
    recordingUrl: string;
  }>,
) {
  const prisma = getPrisma();
  const existing = await prisma.smartRoutingCallSession.findUnique({ where: { id: sessionId } });
  if (!existing) return null;
  const prevState = (existing.stateJson as SessionState) ?? {};
  const nextState = patch.stateJson ? { ...prevState, ...patch.stateJson } : prevState;
  return prisma.smartRoutingCallSession.update({
    where: { id: sessionId },
    data: {
      currentNodeId: patch.currentNodeId ?? existing.currentNodeId,
      stateJson: nextState as object,
      finalOutcome: patch.finalOutcome ?? existing.finalOutcome,
      completedAt: patch.completedAt ?? existing.completedAt,
      answeredAt: patch.answeredAt ?? existing.answeredAt,
      menuSelection: patch.menuSelection ?? existing.menuSelection,
      smsTriggered: patch.smsTriggered ?? existing.smsTriggered,
      recordingUrl: patch.recordingUrl ?? existing.recordingUrl,
    },
  }).then(async (updated: Awaited<ReturnType<typeof prisma.smartRoutingCallSession.update>>) => {
    if (patch.completedAt && !existing.completedAt && !existing.isTest) {
      const { recordSmartRoutingConversationMinutes } = await import(
        "./conversation-minutes"
      );
      await recordSmartRoutingConversationMinutes({
        workspaceId: existing.workspaceId,
        callSessionId: sessionId,
        startedAt: existing.startedAt,
        answeredAt: patch.answeredAt ?? existing.answeredAt,
        completedAt: patch.completedAt,
      }).catch(() => undefined);
    }
    return updated;
  });
}

export async function startCallSession(input: {
  workspaceId: string;
  flowId: string;
  flowVersionId: string;
  callerNumber: string;
  calledNumber: string;
  callControlId: string;
  forwardedFrom?: string;
  isTest?: boolean;
  provider?: "telnyx" | "twilio";
  /** Caller emits FLOW_STARTED after IVR starts (forwarded-leg latency). */
  deferFlowStartedEvent?: boolean;
}) {
  const prisma = getPrisma();
  const correlationId = randomUUID();
  const session = await prisma.smartRoutingCallSession.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      flowId: input.flowId,
      flowVersionId: input.flowVersionId,
      provider: input.provider ?? "telnyx",
      callerNumber: input.callerNumber,
      calledNumber: input.calledNumber,
      forwardedFromNumber: input.forwardedFrom ?? null,
      callControlId: input.callControlId,
      providerCallId: input.callControlId,
      correlationId,
      isTest: input.isTest ?? false,
      stateJson: {},
    },
  });
  if (!input.deferFlowStartedEvent) {
    await emitSmartRoutingEvent({
      workspaceId: input.workspaceId,
      type: "FLOW_STARTED",
      sessionId: session.id,
      flowId: input.flowId,
      payload: { caller: input.callerNumber, isTest: input.isTest },
    });
  }
  return session;
}

export function parseDraftConfig(raw: unknown): DraftConfig {
  if (!raw || typeof raw !== "object") return { nodes: [], edges: [] };
  const obj = raw as Record<string, unknown>;
  return {
    nodes: Array.isArray(obj.nodes) ? (obj.nodes as DraftConfig["nodes"]) : [],
    edges: Array.isArray(obj.edges) ? (obj.edges as DraftConfig["edges"]) : [],
    greeting: obj.greeting as DraftConfig["greeting"],
    menuOptions: Array.isArray(obj.menuOptions)
      ? (obj.menuOptions as DraftConfig["menuOptions"])
      : undefined,
    metadata: obj.metadata as Record<string, unknown>,
  };
}

export function promptHash(text: string, voiceId: string, speed = 1): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256")
    .update(`${normalized}|${voiceId}|${speed}`)
    .digest("hex");
}
