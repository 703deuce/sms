import { AgentSessionEventTypes, type AgentSession } from "@livekit/agents";
import { RealtimeModel } from "@livekit/agents";
import type { FrontDeskUserData } from "../userdata";
import {
  resolveFrontDeskInboundRealtimeTurnDetection,
  type OutboundRealtimeTurnDetection,
} from "../../realtime-turn-config";
import { ensureReceptionistWorkflow } from "./workflow-engine";

type OpenAIRealtimeSessionInternals = {
  sendEvent: (event: Record<string, unknown>) => void;
  _options: {
    turnDetection?: OutboundRealtimeTurnDetection | null;
    isAzure?: boolean;
    apiVersion?: string;
  };
};

type GenerationChain = {
  tail: Promise<void>;
};

const generationChains = new WeakMap<AgentSession<FrontDeskUserData>, GenerationChain>();
const orchestrationChains = new WeakMap<AgentSession<FrontDeskUserData>, GenerationChain>();

function nextEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOpenAIRealtimeSession(
  session: AgentSession<FrontDeskUserData>,
): OpenAIRealtimeSessionInternals | null {
  if (!(session.llm instanceof RealtimeModel)) return null;
  const activity = session._activity;
  if (!activity?.realtimeLLMSession) return null;
  return activity.realtimeLLMSession as unknown as OpenAIRealtimeSessionInternals;
}

function baseInboundTurnDetection(ud: FrontDeskUserData): OutboundRealtimeTurnDetection {
  if (ud.inboundRealtimeTurnDetection) return ud.inboundRealtimeTurnDetection;
  return resolveFrontDeskInboundRealtimeTurnDetection().turnDetection;
}

function turnDetectionForMode(
  base: OutboundRealtimeTurnDetection,
  runtimeOwned: boolean,
): OutboundRealtimeTurnDetection {
  return { ...base, create_response: !runtimeOwned };
}

function logCollectionRealtime(
  callId: string,
  event: string,
  extra?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      source: "collection-realtime-control",
      event,
      callId,
      ...extra,
    }),
  );
}

export function updateRealtimeTurnDetection(
  session: AgentSession<FrontDeskUserData>,
  turnDetection: OutboundRealtimeTurnDetection,
): boolean {
  const rt = getOpenAIRealtimeSession(session);
  if (!rt) return false;

  const prev = rt._options.turnDetection;
  if (
    prev &&
    prev.type === turnDetection.type &&
    prev.create_response === turnDetection.create_response &&
    JSON.stringify(prev) === JSON.stringify(turnDetection)
  ) {
    return false;
  }

  rt._options.turnDetection = turnDetection;
  const isLegacyAzure = rt._options.isAzure && !!rt._options.apiVersion;

  if (isLegacyAzure) {
    rt.sendEvent({
      type: "session.update",
      session: { turn_detection: turnDetection },
      event_id: nextEventId("turn_detection"),
    });
  } else {
    rt.sendEvent({
      type: "session.update",
      session: {
        type: "realtime",
        audio: {
          input: {
            turn_detection: turnDetection,
          },
        },
      },
      event_id: nextEventId("turn_detection"),
    });
  }
  return true;
}

/** During BOOKING_COLLECT / MESSAGE_COLLECT the runtime owns response creation. */
export function syncCollectionRealtimeMode(
  session: AgentSession<FrontDeskUserData>,
  runtimeOwned: boolean,
): void {
  const ud = session.userData;
  if (ud.collectionRuntimeOwnedTurnDetection === runtimeOwned) return;

  const base = baseInboundTurnDetection(ud);
  const turnDetection = turnDetectionForMode(base, runtimeOwned);
  const updated = updateRealtimeTurnDetection(session, turnDetection);
  ud.collectionRuntimeOwnedTurnDetection = runtimeOwned;

  if (updated) {
    logCollectionRealtime(ud.callId, "turn_detection_synced", {
      runtimeOwned,
      create_response: turnDetection.create_response ?? true,
      vadType: turnDetection.type,
    });
  }
}

export function isRuntimeCollectionState(ud: FrontDeskUserData): boolean {
  const wf = ud.receptionistWorkflow;
  return wf?.state === "BOOKING_COLLECT" || wf?.state === "MESSAGE_COLLECT";
}

export function markCollectionAwaitingAnswer(ud: FrontDeskUserData): void {
  ud.collectionAwaitingAnswer = true;
}

export function clearCollectionAwaitingAnswer(ud: FrontDeskUserData): void {
  ud.collectionAwaitingAnswer = false;
}

/** Serialize post-save orchestration (ask next field / list slots) after force_record tool phase. */
export function enqueueCollectionOrchestration(
  session: AgentSession<FrontDeskUserData>,
  work: () => Promise<void>,
): void {
  let chain = orchestrationChains.get(session);
  if (!chain) {
    chain = { tail: Promise.resolve() };
    orchestrationChains.set(session, chain);
  }
  chain.tail = chain.tail
    .then(work)
    .catch((err) => {
      logCollectionRealtime(session.userData.callId, "orchestration_error", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

export async function awaitCollectionOrchestration(
  session: AgentSession<FrontDeskUserData>,
): Promise<void> {
  const chain = orchestrationChains.get(session);
  if (chain) await chain.tail;
}

type ControlledGenerateReplyOptions = {
  instructions?: string;
  toolChoice?: "auto" | "none" | "required";
  allowInterruptions?: boolean;
};

function waitForFunctionTool(
  session: AgentSession<FrontDeskUserData>,
  toolName: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      session.off(AgentSessionEventTypes.FunctionToolsExecuted, onTools);
      resolve(false);
    }, timeoutMs);

    const onTools = (ev: {
      functionCalls: Array<{ name: string }>;
    }): void => {
      if (ev.functionCalls.some((call) => call.name === toolName)) {
        clearTimeout(timer);
        session.off(AgentSessionEventTypes.FunctionToolsExecuted, onTools);
        resolve(true);
      }
    };

    session.on(AgentSessionEventTypes.FunctionToolsExecuted, onTools);
  });
}

/**
 * One active Realtime generation per session — prevents competing speech handles.
 */
export async function controlledGenerateReply(
  session: AgentSession<FrontDeskUserData>,
  source: string,
  turnId: number | string,
  options: ControlledGenerateReplyOptions = {},
): Promise<void> {
  const ud = session.userData;
  const generationId = nextEventId("gen");

  let chain = generationChains.get(session);
  if (!chain) {
    chain = { tail: Promise.resolve() };
    generationChains.set(session, chain);
  }

  const prior = chain.tail;
  let release!: () => void;
  chain.tail = new Promise<void>((resolve) => {
    release = resolve;
  });

  logCollectionRealtime(ud.callId, "generation_requested", {
    generationId,
    generation_source: source,
    turn_id: turnId,
    toolChoice: options.toolChoice ?? "auto",
  });

  await prior;

  try {
    if (session.agentState === "speaking" && source.startsWith("force_record")) {
      session.interrupt();
    }

    const handle = session.generateReply({
      instructions: options.instructions,
      toolChoice: options.toolChoice,
      allowInterruptions: options.allowInterruptions,
    });
    ud.collectionActiveGenerationId = generationId;

    if (source === "force_record_current_field") {
      const toolRan = await waitForFunctionTool(session, "record_current_field", 8000);
      if (session.agentState === "speaking") {
        session.interrupt();
      }
      logCollectionRealtime(ud.callId, "generation_tool_phase_complete", {
        generationId,
        generation_source: source,
        turn_id: turnId,
        toolRan,
      });
      return;
    }

    await handle.waitForPlayout();
    logCollectionRealtime(ud.callId, "generation_completed", {
      generationId,
      generation_source: source,
      turn_id: turnId,
    });
  } catch (err) {
    logCollectionRealtime(ud.callId, "generation_failed", {
      generationId,
      generation_source: source,
      turn_id: turnId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    if (ud.collectionActiveGenerationId === generationId) {
      ud.collectionActiveGenerationId = undefined;
    }
    release();
  }
}

export function initInboundRealtimeTurnDetection(
  ud: FrontDeskUserData,
  turnDetection?: OutboundRealtimeTurnDetection,
): void {
  ud.inboundRealtimeTurnDetection =
    turnDetection ?? resolveFrontDeskInboundRealtimeTurnDetection().turnDetection;
}

export function bumpCollectionTurnSeq(ud: FrontDeskUserData): number {
  const wf = ensureReceptionistWorkflow(ud);
  const next = (wf.collectionTurnSeq ?? 0) + 1;
  wf.collectionTurnSeq = next;
  return next;
}
