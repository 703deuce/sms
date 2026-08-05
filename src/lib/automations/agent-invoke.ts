/**
 * Explicit Use Agent / Run Voice Agent invocation rules.
 *
 * Use Agent (overall automations) — invoke a *different* agent:
 *   - run_primary_workflow
 *   - invoke_task
 *   - hand_off_conversation
 *
 * Run Voice Agent (agent primary workflow) — attach/start THIS voice agent.
 * Never express "run myself" via Use Agent → prevents recursive enroll loops.
 */

export const MAX_AGENT_INVOKE_DEPTH = 5;

export type UseAgentMode =
  | "run_primary_workflow"
  | "invoke_task"
  | "hand_off_conversation";

export const USE_AGENT_MODE_OPTIONS: Array<{
  id: UseAgentMode;
  label: string;
  description: string;
}> = [
  {
    id: "run_primary_workflow",
    label: "Run primary workflow",
    description:
      "Enroll the contact in the other agent’s primary AutomationFlow (SMS sequences, review requests, reminders).",
  },
  {
    id: "invoke_task",
    label: "Invoke task",
    description:
      "Run a bounded agent task and capture structured output (e.g. qualify a lead).",
  },
  {
    id: "hand_off_conversation",
    label: "Hand off conversation",
    description:
      "Start or hand off a live voice/messaging conversation to another agent.",
  },
];

export function normalizeUseAgentMode(raw: unknown): UseAgentMode {
  const v = String(raw || "").trim();
  // Legacy auto/workflow/voice_call → explicit modes
  if (v === "run_primary_workflow" || v === "workflow") return "run_primary_workflow";
  if (v === "invoke_task" || v === "task") return "invoke_task";
  if (
    v === "hand_off_conversation" ||
    v === "voice_call" ||
    v === "conversation"
  ) {
    return "hand_off_conversation";
  }
  // Default for overall composition: run the other agent's primary flow.
  return "run_primary_workflow";
}

export function agentInvokeKey(input: {
  agentId?: string | null;
  setupId?: string | null;
}): string | null {
  if (input.setupId) return `setup:${input.setupId}`;
  if (input.agentId) return `agent:${input.agentId}`;
  return null;
}

export type AgentInvokeGuardInput = {
  targetKey: string;
  /** Current flow id — cannot enroll this same flow. */
  currentFlowId: string;
  targetPrimaryFlowId?: string | null;
  /** Owner of the current flow (self). */
  currentOwnerKey?: string | null;
  /** Chain of agents already invoked on this contact path. */
  agentChain?: string[];
  maxDepth?: number;
};

export type AgentInvokeGuardResult =
  | { ok: true; nextChain: string[]; depth: number }
  | {
      ok: false;
      error:
        | "use_agent_self_invoke"
        | "use_agent_cycle"
        | "use_agent_depth"
        | "use_agent_same_flow";
      message: string;
    };

export function checkAgentInvokeGuards(
  input: AgentInvokeGuardInput,
): AgentInvokeGuardResult {
  const chain = Array.isArray(input.agentChain) ? [...input.agentChain] : [];
  const max = input.maxDepth ?? MAX_AGENT_INVOKE_DEPTH;

  if (
    input.currentOwnerKey &&
    input.targetKey === input.currentOwnerKey
  ) {
    return {
      ok: false,
      error: "use_agent_self_invoke",
      message:
        "Use Agent cannot target the agent that owns this workflow. Use Run Voice Agent inside a voice agent’s primary flow instead.",
    };
  }

  if (chain.includes(input.targetKey)) {
    return {
      ok: false,
      error: "use_agent_cycle",
      message: `Circular agent chain detected (${[...chain, input.targetKey].join(" → ")}).`,
    };
  }

  if (chain.length >= max) {
    return {
      ok: false,
      error: "use_agent_depth",
      message: `Agent-to-agent depth exceeded (max ${max}).`,
    };
  }

  if (
    input.targetPrimaryFlowId &&
    input.targetPrimaryFlowId === input.currentFlowId
  ) {
    return {
      ok: false,
      error: "use_agent_same_flow",
      message:
        "Cannot enroll this flow into itself. Use Run Voice Agent for in-flow voice execution.",
    };
  }

  const nextChain = [...chain, input.targetKey];
  return { ok: true, nextChain, depth: nextChain.length };
}

export function readAgentChainFromMetadata(
  metadata: unknown,
): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const m = metadata as Record<string, unknown>;
  const vars =
    m.variables && typeof m.variables === "object"
      ? (m.variables as Record<string, unknown>)
      : null;
  const fromVars = vars?.agentChain;
  const fromRoot = m.agentChain;
  const raw = Array.isArray(fromVars)
    ? fromVars
    : Array.isArray(fromRoot)
      ? fromRoot
      : [];
  return raw.filter((x): x is string => typeof x === "string");
}
