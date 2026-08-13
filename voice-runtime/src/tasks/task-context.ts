import {
  LLM,
  RealtimeModel,
  type AgentOptions,
  type AgentSession,
  type ChatContext,
} from "@livekit/agents";

/** Options every nested AgentTask should receive from its parent tool/agent. */
export type NestedTaskContextOptions = {
  chatCtx?: ChatContext;
  preserveFunctionCallHistory?: boolean;
};

type AgentTaskSuperOptions<UserData> = AgentOptions<UserData> & {
  preserveFunctionCallHistory: boolean;
};

/**
 * LiveKit sub-tasks start with an empty chat_ctx unless the parent passes its own.
 * Always pass session.chatCtx and preserve parent function-call history so inline
 * tool execution (schedule_appointment inside a tool) does not orphan FC pairs.
 */
export function nestedTaskOptionsFromSession<UserData>(
  session: AgentSession<UserData>,
  overrides?: Partial<NestedTaskContextOptions>,
): NestedTaskContextOptions {
  return {
    chatCtx: overrides?.chatCtx ?? session.chatCtx,
    preserveFunctionCallHistory: overrides?.preserveFunctionCallHistory ?? true,
  };
}

/**
 * Receptionist operational sub-tasks (field collection): isolated chat context,
 * no function-call replay into parent Realtime session on handoff return.
 * Collected state lives in session userData, not merged child transcript.
 */
export function receptionistOperationalTaskOptionsFromSession<UserData>(
  _session: AgentSession<UserData>,
): NestedTaskContextOptions {
  return {
    // Isolated ctx — parent keeps authoritative transcript; merge adds no duplicate ids.
    chatCtx: ChatContext.empty(),
    preserveFunctionCallHistory: false,
  };
}

/** Realtime-only sessions have no standard LLM — TaskGroup summarization would fail. */
export function sessionUsesRealtimeLlm(session: AgentSession<any>): boolean {
  return session.llm instanceof RealtimeModel;
}

/**
 * Healthcare TaskGroup passes chat_ctx and summarizes on completion (default summarizeChatCtx=true).
 * out_of_scope regression is built into the SDK TaskGroup when prior tasks were visited.
 */
export function taskGroupOptionsFromSession<UserData>(session: AgentSession<UserData>) {
  const summarizeChatCtx = !sessionUsesRealtimeLlm(session);
  return {
    summarizeChatCtx,
    chatCtx: session.chatCtx,
    preserveFunctionCallHistory: true as const,
  };
}

export function agentTaskSuperOptions<UserData = unknown>(
  base: Pick<AgentOptions<UserData>, "instructions" | "tools">,
  options?: NestedTaskContextOptions,
): AgentTaskSuperOptions<UserData> {
  return {
    ...base,
    chatCtx: options?.chatCtx,
    preserveFunctionCallHistory: options?.preserveFunctionCallHistory ?? true,
  };
}

/**
 * Healthcare ModifyAppointmentTask summarizes parent chat_ctx before nested ScheduleAppointmentTask.
 * @see examples/healthcare/agent.py confirm_appointment_selection reschedule branch
 */
export async function summarizeChatContextForNestedTask<UserData>(
  session: AgentSession<UserData>,
  options?: { keepLastTurns?: number },
): Promise<ChatContext> {
  const keepLastTurns = options?.keepLastTurns ?? 0;
  const sessionLlm = session.llm;
  if (!(sessionLlm instanceof LLM)) {
    return session.chatCtx;
  }
  return session.chatCtx.copy()._summarize(sessionLlm, { keepLastTurns });
}
