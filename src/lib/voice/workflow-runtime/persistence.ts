import { getPrisma } from "@/lib/db";
import type { WorkflowDefinition } from "./schema";
import { assertValidWorkflowDefinition } from "./validator";
import type { ActiveWorkflowRef } from "./loader";
import { registerWorkflowDefinition, getWorkflowDefinition } from "./loader";
import {
  APPOINTMENT_BOOKING_WORKFLOW_V1,
  MESSAGE_TAKING_WORKFLOW_V1,
} from "./definitions";

export type VoiceWorkflowStore = {
  definitions: Record<string, Record<number, WorkflowDefinition>>;
  activeByAgent: Record<string, ActiveWorkflowRef>;
};

const VOICE_WORKFLOW_KEY = "voiceWorkflow";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseStore(raw: unknown): VoiceWorkflowStore {
  const data = asRecord(raw);
  const definitions: VoiceWorkflowStore["definitions"] = {};
  const defsRaw = asRecord(data.definitions);
  for (const [workflowId, versions] of Object.entries(defsRaw)) {
    definitions[workflowId] = {};
    const verMap = asRecord(versions);
    for (const [ver, def] of Object.entries(verMap)) {
      definitions[workflowId][Number(ver)] = def as WorkflowDefinition;
    }
  }
  const activeRaw = asRecord(data.activeByAgent);
  const activeByAgent: Record<string, ActiveWorkflowRef> = {};
  for (const [agentId, ref] of Object.entries(activeRaw)) {
    const r = asRecord(ref);
    if (r.workflowId) {
      activeByAgent[agentId] = {
        workflowId: String(r.workflowId),
        version: Number(r.version || 1),
      };
    }
  }
  return { definitions, activeByAgent };
}

function defaultStore(): VoiceWorkflowStore {
  return {
    definitions: {
      appointment_booking: { 1: APPOINTMENT_BOOKING_WORKFLOW_V1 },
      message_taking: { 1: MESSAGE_TAKING_WORKFLOW_V1 },
    },
    activeByAgent: {},
  };
}

export function extractVoiceWorkflowStore(draftConfig: unknown): VoiceWorkflowStore {
  const config = asRecord(draftConfig);
  const advanced = asRecord(config.advanced);
  const store = parseStore(advanced[VOICE_WORKFLOW_KEY]);
  if (!Object.keys(store.definitions).length) {
    return defaultStore();
  }
  return store;
}

export async function loadVoiceWorkflowStoreForAgent(input: {
  workspaceId: string;
  agentId: string;
}): Promise<VoiceWorkflowStore> {
  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true, publishedVersionId: true },
  });
  if (!agent) return defaultStore();

  let store = extractVoiceWorkflowStore(agent.draftConfig);

  if (agent.publishedVersionId) {
    const version = await getPrisma().voiceAgentVersion.findFirst({
      where: { id: agent.publishedVersionId, agentId: input.agentId },
      select: { config: true },
    });
    if (version?.config) {
      store = extractVoiceWorkflowStore(version.config);
    }
  }

  for (const versions of Object.values(store.definitions)) {
    for (const def of Object.values(versions)) {
      try {
        registerWorkflowDefinition(def);
      } catch {
        // skip invalid stored definitions
      }
    }
  }

  return store;
}

export function resolveActiveWorkflowRef(
  store: VoiceWorkflowStore,
  agentId: string,
): ActiveWorkflowRef {
  const fromAgent = store.activeByAgent[agentId];
  if (fromAgent) return fromAgent;

  if (store.activeByAgent.default) return store.activeByAgent.default;

  return { workflowId: "appointment_booking", version: 1 };
}

export async function persistVoiceWorkflowDefinition(input: {
  workspaceId: string;
  agentId: string;
  definition: WorkflowDefinition;
  setActive?: boolean;
}): Promise<ActiveWorkflowRef> {
  assertValidWorkflowDefinition(input.definition);
  registerWorkflowDefinition(input.definition);

  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true },
  });
  if (!agent) throw new Error("Agent not found");

  const config = asRecord(agent.draftConfig);
  const advanced = asRecord(config.advanced);
  const store = extractVoiceWorkflowStore(agent.draftConfig);

  if (!store.definitions[input.definition.id]) {
    store.definitions[input.definition.id] = {};
  }
  store.definitions[input.definition.id][input.definition.version] = input.definition;

  const ref: ActiveWorkflowRef = {
    workflowId: input.definition.id,
    version: input.definition.version,
  };
  if (input.setActive !== false) {
    store.activeByAgent[input.agentId] = ref;
  }

  const nextConfig = {
    ...config,
    advanced: {
      ...advanced,
      [VOICE_WORKFLOW_KEY]: store,
    },
  };

  await getPrisma().voiceAgent.update({
    where: { id: input.agentId },
    data: { draftConfig: nextConfig },
  });

  return ref;
}

export async function pinWorkflowOnCall(input: {
  callId: string;
  ref: ActiveWorkflowRef;
  entryNodeId: string;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: input.callId },
    select: { metadata: true },
  });
  if (!call) return;
  const meta = asRecord(call.metadata);
  const runtime = asRecord(meta.agentRuntime);
  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        ...meta,
        voiceWorkflowPin: {
          workflowId: input.ref.workflowId,
          version: input.ref.version,
          pinnedAt: new Date().toISOString(),
        },
        agentRuntime: {
          ...runtime,
          voice_workflow_id: input.ref.workflowId,
          voice_workflow_version: input.ref.version,
          current_node_id: input.entryNodeId,
        },
      },
    },
  });
}

export function getPinnedWorkflowFromCall(metadata: unknown): ActiveWorkflowRef | null {
  const meta = asRecord(metadata);
  const pin = asRecord(meta.voiceWorkflowPin);
  if (pin.workflowId) {
    return {
      workflowId: String(pin.workflowId),
      version: Number(pin.version || 1),
    };
  }
  const runtime = asRecord(meta.agentRuntime);
  if (runtime.voice_workflow_id) {
    return {
      workflowId: String(runtime.voice_workflow_id),
      version: Number(runtime.voice_workflow_version || 1),
    };
  }
  return null;
}

export function loadDefinitionFromStore(
  store: VoiceWorkflowStore,
  ref: ActiveWorkflowRef,
): WorkflowDefinition | undefined {
  return (
    store.definitions[ref.workflowId]?.[ref.version] ||
    getWorkflowDefinition(ref.workflowId, ref.version)
  );
}
