import {
  AgentSessionEventTypes,
  ChatMessage,
  type ConversationItemAddedEvent,
  type voice,
} from "@livekit/agents";
import { appendLiveKitTranscriptLine } from "@/lib/voice/runtime-provider/livekit-call-telemetry";

function messageText(item: ChatMessage): string | null {
  const text = item.textContent?.trim();
  return text || null;
}

function speakerForRole(role: string): string {
  if (role === "user") return "caller";
  if (role === "assistant") return "agent";
  return role;
}

export function attachLiveKitTranscriptPersistence<T>(
  session: voice.AgentSession<T>,
  input: { workspaceId: string; callId: string },
) {
  session.on(AgentSessionEventTypes.ConversationItemAdded, (ev: ConversationItemAddedEvent) => {
    const item = ev.item;
    if (!(item instanceof ChatMessage)) return;
    const text = messageText(item);
    if (!text) return;
    void appendLiveKitTranscriptLine({
      workspaceId: input.workspaceId,
      callId: input.callId,
      speaker: speakerForRole(item.role),
      text,
      confidence: item.transcriptConfidence,
    }).catch((err) => {
      console.warn(
        JSON.stringify({
          source: "transovo-voice-runtime",
          event: "transcript_persist_failed",
          callId: input.callId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    });
  });
}
