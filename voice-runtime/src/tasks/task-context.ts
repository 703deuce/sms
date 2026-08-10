import type { AgentSession, ChatContext } from "@livekit/agents";

/** Options every nested AgentTask should receive from its parent tool/agent. */
export type NestedTaskContextOptions = {
  chatCtx?: ChatContext;
  preserveFunctionCallHistory?: boolean;
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

/** TaskGroup shares conversational context across sequential collection tasks. */
export function taskGroupOptionsFromSession<UserData>(session: AgentSession<UserData>) {
  return {
    summarizeChatCtx: false as const,
    chatCtx: session.chatCtx,
    preserveFunctionCallHistory: true as const,
  };
}

export function agentTaskSuperOptions(
  base: {
    instructions: string;
    tools?: unknown[];
  },
  options?: NestedTaskContextOptions,
) {
  return {
    ...base,
    chatCtx: options?.chatCtx,
    preserveFunctionCallHistory: options?.preserveFunctionCallHistory ?? true,
  };
}
