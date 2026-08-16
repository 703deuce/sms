import type { AgentSession } from "@livekit/agents";
import { resyncOpenAIRealtimeAgentChatCtx } from "./realtime-openai-chat-context";
import type { FrontDeskUserData } from "./frontdesk/userdata";

/**
 * Push an authoritative runtime outcome into OpenAI Realtime chat context when tool results
 * may not survive item-chain corruption (booking confirm, transfer result, etc.).
 */
export async function injectAuthoritativeToolOutcome(
  session: AgentSession<FrontDeskUserData>,
  input: {
    headline: string;
    detail: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const agent = session.currentAgent;
  if (!agent) return;

  const payload =
    input.payload && Object.keys(input.payload).length > 0
      ? ` ${JSON.stringify(input.payload)}`
      : "";

  const content = `${input.headline} ${input.detail}${payload}`;

  const chatCtx = agent.chatCtx.copy();
  chatCtx.addMessage({ role: "system", content });
  await agent.updateChatCtx(chatCtx);
  await resyncOpenAIRealtimeAgentChatCtx(agent);
}
