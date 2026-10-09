import "server-only";

import { getArAiReschedulerModelId } from "../model";
import { openAiChatTextResponse, type ChatMessage } from "../v3-workflow/openai-tools";
import type { ArSmsSharedTurnSnapshot } from "../ar-sms-shared-snapshot";
import { formatSnapshotForContextAgentUserMessage } from "../ar-sms-shared-snapshot";
import { AR_SMS_CONTEXT_AGENT_SYSTEM_PROMPT } from "./ar-sms-context-agent-prompt";
import {
  fallbackArSmsContextNotes,
  normalizeArSmsContextNotes,
  type ArSmsContextNotes,
} from "./ar-sms-context-notes";
import { logArSmsPipeline } from "@/lib/appointment-reminders/messaging/pipeline-log";

export async function runArSmsContextAgent(input: {
  snapshot: ArSmsSharedTurnSnapshot;
}): Promise<ArSmsContextNotes> {
  logArSmsPipeline({
    step: "context_agent_start",
    workspaceId: input.snapshot.workspaceId,
    replySessionId: input.snapshot.replySessionId,
    appointmentId: input.snapshot.appointmentId,
    conversationId: input.snapshot.conversationId,
    providerMessageId: input.snapshot.providerMessageId,
    meta: { historyTurns: input.snapshot.conversationHistory.length },
  });

  const messages: ChatMessage[] = [
    { role: "system", content: AR_SMS_CONTEXT_AGENT_SYSTEM_PROMPT },
    {
      role: "user",
      content: formatSnapshotForContextAgentUserMessage(input.snapshot),
    },
  ];

  try {
    const raw = await openAiChatTextResponse({
      messages,
      model: getArAiReschedulerModelId(),
      reasoningEffort: "medium",
      temperature: 0.2,
      maxTokens: 900,
    });
    const notes = raw ? normalizeArSmsContextNotes(raw) : fallbackArSmsContextNotes("empty_model_response");

    logArSmsPipeline({
      step: "context_agent_completed",
      workspaceId: input.snapshot.workspaceId,
      replySessionId: input.snapshot.replySessionId,
      appointmentId: input.snapshot.appointmentId,
      providerMessageId: input.snapshot.providerMessageId,
      ok: Boolean(raw?.trim()),
      meta: { notesLength: notes.length },
    });

    return notes;
  } catch (err) {
    const notes = fallbackArSmsContextNotes(
      err instanceof Error ? err.message : "context_agent_failed",
    );
    logArSmsPipeline({
      step: "context_agent_completed",
      workspaceId: input.snapshot.workspaceId,
      replySessionId: input.snapshot.replySessionId,
      appointmentId: input.snapshot.appointmentId,
      providerMessageId: input.snapshot.providerMessageId,
      ok: false,
      error: err instanceof Error ? err.message : "context_agent_failed",
      meta: { notesLength: notes.length },
    });
    return notes;
  }
}
