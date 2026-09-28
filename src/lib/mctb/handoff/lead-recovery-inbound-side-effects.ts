/**
 * Team / audit side effects for MCTB customer SMS — not a customer-facing agent.
 * Lead Recovery is the only conversational path for inbound MCTB SMS.
 */
import type { StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";
import { processMctbInboundReplyHandoff } from "./inbound-reply-handoff";

export async function recordMctbLeadRecoveryInboundSideEffects(input: {
  workspaceId: string;
  fromE164: string;
  body: string;
  conversationId: string;
  missedCallEventId: string;
  providerMessageId?: string | null;
  structuredIntent?: StructuredLeadIntent | null;
}): Promise<void> {
  await processMctbInboundReplyHandoff(input);
}
