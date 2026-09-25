import "server-only";

import { getPrisma } from "@/lib/db";
import { takeOverMctbConversation } from "@/lib/mctb/handoff/process-inbound-reply";
import { isMctbConversationProductSource } from "@/lib/mctb/inbox/is-mctb-conversation-record";
import { shouldBlockAutomation } from "@/lib/mctb/handoff/automation-state";

const AI_ACTIVE_STATES = new Set([
  "automation_active",
  "collecting_information",
  "waiting_for_customer",
  "waiting_for_caller",
  "callback_requested",
  "urgent",
  "appointment_offered",
  "needs_human",
]);

/**
 * When staff sends manual SMS on an MCTB thread, establish human ownership before outbound send.
 * Race: in-flight AI job may still complete one reply if started before takeover — see certification doc.
 */
export async function ensureMctbHumanOwnershipBeforeManualSend(input: {
  workspaceId: string;
  conversationId: string;
  userId: string;
}): Promise<void> {
  const prisma = getPrisma();
  const conv = await prisma.conversation.findFirst({
    where: { id: input.conversationId, workspaceId: input.workspaceId },
    select: { productSource: true },
  });
  if (!conv || !isMctbConversationProductSource(conv.productSource)) return;

  const automation = await prisma.mctbConversationAutomationState.findFirst({
    where: { conversationId: input.conversationId, workspaceId: input.workspaceId },
    select: { state: true },
  });
  const state = automation?.state ?? null;
  if (!state || shouldBlockAutomation(state)) return;
  if (!AI_ACTIVE_STATES.has(state) && state !== "human_active") return;

  await takeOverMctbConversation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    userId: input.userId,
  });
}
