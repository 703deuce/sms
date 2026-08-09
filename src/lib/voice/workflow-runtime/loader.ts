import type { WorkflowDefinition } from "./schema";
import { assertValidWorkflowDefinition } from "./validator";
import {
  APPOINTMENT_BOOKING_WORKFLOW_V1,
  MESSAGE_TAKING_WORKFLOW_V1,
  MESSAGE_TAKING_WORKFLOW_V2,
} from "./definitions";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "./definitions/home-service-dispatcher";

export type ActiveWorkflowRef = {
  workflowId: string;
  version: number;
};

const REGISTRY: Record<string, Record<number, WorkflowDefinition>> = {
  appointment_booking: {
    1: APPOINTMENT_BOOKING_WORKFLOW_V1,
  },
  message_taking: {
    1: MESSAGE_TAKING_WORKFLOW_V1,
    2: MESSAGE_TAKING_WORKFLOW_V2,
  },
  home_service_dispatcher: {
    1: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
  },
};

/** Per-agent active workflow version — replaced by DB when Amber publishes. */
const AGENT_ACTIVE_WORKFLOW: Record<string, ActiveWorkflowRef> = {
  default: { workflowId: "appointment_booking", version: 1 },
};

export function registerWorkflowDefinition(def: WorkflowDefinition): void {
  assertValidWorkflowDefinition(def);
  if (!REGISTRY[def.id]) REGISTRY[def.id] = {};
  REGISTRY[def.id][def.version] = def;
}

export function getWorkflowDefinition(
  workflowId: string,
  version: number,
): WorkflowDefinition | undefined {
  return REGISTRY[workflowId]?.[version];
}

export function setActiveWorkflowForAgent(
  agentId: string,
  ref: ActiveWorkflowRef,
): void {
  const def = getWorkflowDefinition(ref.workflowId, ref.version);
  if (!def) {
    throw new Error(`Unknown workflow ${ref.workflowId} v${ref.version}`);
  }
  AGENT_ACTIVE_WORKFLOW[agentId] = ref;
}

export function getActiveWorkflowForAgent(agentId: string): {
  definition: WorkflowDefinition;
  ref: ActiveWorkflowRef;
} {
  const ref =
    AGENT_ACTIVE_WORKFLOW[agentId] ||
    AGENT_ACTIVE_WORKFLOW.default ||
    ({ workflowId: "appointment_booking", version: 1 } as ActiveWorkflowRef);

  const definition = getWorkflowDefinition(ref.workflowId, ref.version);
  if (!definition) {
    throw new Error(`Active workflow not found: ${ref.workflowId} v${ref.version}`);
  }
  return { definition, ref };
}

/** Apply DB-backed store — registers definitions and sets per-agent active refs. */
export function applyVoiceWorkflowStore(store: {
  definitions: Record<string, Record<number, WorkflowDefinition>>;
  activeByAgent: Record<string, ActiveWorkflowRef>;
}): void {
  for (const versions of Object.values(store.definitions)) {
    for (const def of Object.values(versions)) {
      try {
        registerWorkflowDefinition(def);
      } catch {
        // skip invalid stored definitions
      }
    }
  }
  for (const [agentId, ref] of Object.entries(store.activeByAgent)) {
    if (getWorkflowDefinition(ref.workflowId, ref.version)) {
      AGENT_ACTIVE_WORKFLOW[agentId] = ref;
    }
  }
}

/** Env override for message-taking proof without code deploy. */
export function resolveActiveWorkflowForAgent(agentId: string): {
  definition: WorkflowDefinition;
  ref: ActiveWorkflowRef;
} {
  const override = process.env.VOICE_ACTIVE_WORKFLOW?.trim();
  if (override) {
    const [workflowId, versionRaw] = override.split(":");
    const version = Number(versionRaw || "1");
    const definition = getWorkflowDefinition(workflowId, version);
    if (definition) {
      return { definition, ref: { workflowId, version } };
    }
  }
  return getActiveWorkflowForAgent(agentId);
}
