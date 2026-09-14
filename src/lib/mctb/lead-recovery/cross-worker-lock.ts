/**
 * Cross-worker conversation serialization.
 * Uses in-process chaining per conversation; do NOT hold Postgres transactions
 * across LLM/provider calls (webhook timeouts and lock leaks cause silent no-reply).
 */
import { withLeadRecoveryConversationLock } from "@/lib/mctb/lead-recovery/conversation-guard";

export async function withLeadRecoveryCrossWorkerLock<T>(
  conversationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withLeadRecoveryConversationLock(conversationId, fn);
}
