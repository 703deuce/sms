import "server-only";

import type { AgentConfig } from "@/lib/agent";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";
import { resolveSchedulingBackend } from "@/lib/server/voice-v3/scheduling/connections";

/** Attach live calendar connection metadata for FIND/BOOK (resolved at session start). */
export async function enrichVoiceV3AgentConfigForRuntime(input: {
  config: VoiceV3AgentConfig;
  workspaceId: string;
  editor: AgentConfig;
}): Promise<VoiceV3AgentConfig> {
  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    return input.config;
  }
  if (backend.provider === "calendly") {
    return {
      ...input.config,
      calendar: {
        provider: "calendly",
        connectionId: backend.connectionId,
        calendarIds: [],
        eventTypeUri: backend.eventTypeUri ?? undefined,
      },
    };
  }
  return {
    ...input.config,
    calendar: {
      provider: backend.provider,
      connectionId: backend.connectionId,
      calendarIds: [backend.calendarId],
      writeCalendarId: backend.calendarId,
    },
  };
}
