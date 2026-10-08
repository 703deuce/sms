import "server-only";

import { getArAiReschedulerModelId } from "../model";
import { openAiChatJsonResponse, type ChatMessage } from "../v3-workflow/openai-tools";
import type { ArSmsSharedTurnSnapshot } from "../ar-sms-shared-snapshot";
import { formatSnapshotForContextAgentUserMessage } from "../ar-sms-shared-snapshot";
import { AR_SMS_CONTEXT_AGENT_SYSTEM_PROMPT } from "./ar-sms-context-agent-prompt";
import {
  arSmsContextInterpretationJsonSchema,
  fallbackArSmsContextInterpretation,
  parseArSmsContextInterpretation,
  type ArSmsContextInterpretation,
} from "./ar-sms-context-schema";
import { logArSmsPipeline } from "@/lib/appointment-reminders/messaging/pipeline-log";

export async function runArSmsContextAgent(input: {
  snapshot: ArSmsSharedTurnSnapshot;
}): Promise<ArSmsContextInterpretation> {
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
    const raw = await openAiChatJsonResponse({
      messages,
      model: getArAiReschedulerModelId(),
      reasoningEffort: "medium",
      jsonSchema: arSmsContextInterpretationJsonSchema as Record<string, unknown>,
      schemaName: "ar_sms_context_interpretation",
    });
    const parsed = parseArSmsContextInterpretation(raw);
    const interpretation = parsed ?? fallbackArSmsContextInterpretation("invalid_context_agent_json");

    logArSmsPipeline({
      step: "context_agent_completed",
      workspaceId: input.snapshot.workspaceId,
      replySessionId: input.snapshot.replySessionId,
      appointmentId: input.snapshot.appointmentId,
      providerMessageId: input.snapshot.providerMessageId,
      ok: Boolean(parsed),
      meta: {
        intent: interpretation.intent,
        intent_confidence: interpretation.intent_confidence,
        needs_clarification: interpretation.needs_clarification,
      },
    });

    return interpretation;
  } catch (err) {
    const interpretation = fallbackArSmsContextInterpretation(
      err instanceof Error ? err.message : "context_agent_failed",
    );
    logArSmsPipeline({
      step: "context_agent_completed",
      workspaceId: input.snapshot.workspaceId,
      replySessionId: input.snapshot.replySessionId,
      appointmentId: input.snapshot.appointmentId,
      providerMessageId: input.snapshot.providerMessageId,
      ok: false,
      error: interpretation.clarification_topic ?? "context_agent_failed",
    });
    return interpretation;
  }
}
