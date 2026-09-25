import type { Conversation } from "@/lib/inbox/conversation-types";

/** Authoritative MCTB inbox thread detection — product source only. */
export function isMctbInboxThread(convo: Pick<Conversation, "productSource">): boolean {
  return convo.productSource === "mctb";
}

export function isMctbProductSource(productSource: string | null | undefined): boolean {
  return productSource === "mctb";
}
