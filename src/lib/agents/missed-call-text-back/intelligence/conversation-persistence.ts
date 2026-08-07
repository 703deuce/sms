/**
 * John conversation persistence — AgentTurn, RuntimeTurn, messages.
 */

import { getPrisma } from "@/lib/db";
import { appendMctbTrace } from "../trace";
import type { JohnAgentTurnRecord } from "./types";
import { randomUUID } from "crypto";

export async function persistJohnAgentTurn(input: {
  workspaceId: string;
  traceId: string;
  missedCallEventId?: string | null;
  conversationId?: string | null;
  turn: JohnAgentTurnRecord;
}) {
  const prisma = getPrisma();
  const modelRequestId = input.turn.modelRequestId || randomUUID();

  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: input.missedCallEventId || null,
    conversationId: input.conversationId || null,
    kind: "john.agent_turn",
    detail: {
      direction: input.turn.direction,
      message_body: input.turn.messageBody,
      model_provider: input.turn.modelProvider,
      model_name: input.turn.modelName,
      model_request_id: modelRequestId,
      runtime_action: input.turn.runtimeAction,
      runtime_result: input.turn.runtimeResult,
    },
  });

  if (input.conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
    });
    if (conv) {
      await prisma.conversationMessage.create({
        data: {
          conversationId: input.conversationId,
          direction: input.turn.direction === "inbound" ? "inbound" : "outbound",
          body: input.turn.messageBody,
        },
      });
    }
  }

  return { modelRequestId };
}

export async function persistJohnRuntimeTurn(input: {
  workspaceId: string;
  traceId: string;
  missedCallEventId?: string | null;
  conversationId?: string | null;
  runtimeAction: string;
  runtimeInput: unknown;
  runtimeResult: unknown;
}) {
  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    missedCallEventId: input.missedCallEventId || null,
    conversationId: input.conversationId || null,
    kind: "john.runtime_turn",
    detail: {
      runtime_action: input.runtimeAction,
      runtime_input: input.runtimeInput,
      runtime_result: input.runtimeResult,
    },
  });
}

export async function loadJohnConversationHistory(input: {
  workspaceId: string;
  contactId: string;
  limit?: number;
}) {
  const prisma = getPrisma();
  const messages = await prisma.conversationMessage.findMany({
    where: {
      conversation: { workspaceId: input.workspaceId, contactId: input.contactId },
    },
    orderBy: { createdAt: "desc" },
    take: input.limit || 12,
  });
  return messages.reverse();
}

export async function findJohnAgentTurns(input: {
  workspaceId: string;
  traceId: string;
}) {
  const prisma = getPrisma();
  const traces = await prisma.missedCallTextTrace.findMany({
    where: {
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      kind: "john.agent_turn",
    },
    orderBy: { createdAt: "asc" },
  });
  return traces;
}
