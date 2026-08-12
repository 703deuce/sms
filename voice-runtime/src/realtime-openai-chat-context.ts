import {
  ChatContext,
  RealtimeModel,
  type RealtimeSession,
} from "@livekit/agents";

/**
 * OpenAI Realtime cannot serialize LiveKit agent_handoff / agent_config_update items.
 * Filter them before updateChatCtx — handoff state stays in LiveKit session history.
 */
export function chatContextForOpenAIRealtime(chatCtx: ChatContext): ChatContext {
  return chatCtx.copy({
    excludeHandoff: true,
    excludeConfigUpdate: true,
  });
}

export function wrapRealtimeSessionForOpenAI(session: RealtimeSession): RealtimeSession {
  const sanitize = (ctx: ChatContext) => chatContextForOpenAIRealtime(ctx);

  const originalUpdateChatCtx = session.updateChatCtx.bind(session);
  session.updateChatCtx = async (chatCtx: ChatContext) => {
    return originalUpdateChatCtx(sanitize(chatCtx));
  };

  const originalUpdateSession = session._updateSession.bind(session);
  session._updateSession = async (instructions?, chatCtx?, tools?) => {
    return originalUpdateSession(
      instructions,
      chatCtx !== undefined ? sanitize(chatCtx) : undefined,
      tools,
    );
  };

  return session;
}

/**
 * Wrap any RealtimeModel so OpenAI session updates never receive agent_handoff items.
 */
export class OpenAIRealtimeModelAdapter extends RealtimeModel {
  constructor(private readonly inner: RealtimeModel) {
    super(inner.capabilities);
  }

  get model(): string {
    return this.inner.model;
  }

  get provider(): string {
    return this.inner.provider;
  }

  label(): string {
    return this.inner.label();
  }

  session(): RealtimeSession {
    return wrapRealtimeSessionForOpenAI(this.inner.session());
  }

  async close(): Promise<void> {
    return this.inner.close();
  }
}

export function wrapRealtimeModelForOpenAI(model: RealtimeModel): RealtimeModel {
  if (model instanceof OpenAIRealtimeModelAdapter) {
    return model;
  }
  return new OpenAIRealtimeModelAdapter(model);
}
