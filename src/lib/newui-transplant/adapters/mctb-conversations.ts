import type { Conversation, Message } from "@/newui-transplant/lib/view-models";
import type { Conversation as ApiConversation } from "@/lib/types";

function mapMessage(m: ApiConversation["messages"][number]): Message {
  const text = m.body?.trim() || "";
  const time = m.at
    ? new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";
  if (m.direction === "note") {
    return { from: "system", text, time };
  }
  if (m.direction === "in") {
    return { from: "customer", text, time };
  }
  return { from: "business", text, time, status: "Sent" };
}

function consentLabelFromSource(productSource: ApiConversation["productSource"]): string {
  if (productSource === "mctb") return "Missed call recovery";
  return "—";
}

function composerFooterFromThread(convo: ApiConversation): string {
  const segments = Math.max(1, Math.ceil((convo.lastMessage?.length || 0) / 160));
  const blocked = convo.tags?.includes("opted_out");
  const eligibility = blocked ? "Customer has opted out" : "Customer has not opted out";
  return `${convo.lastMessage?.length ?? 0} / 160 · ${segments} segment · ${eligibility}`;
}

export function mapApiConversationToNewUiInbox(convo: ApiConversation): Conversation {
  const name = convo.contactName?.trim() || convo.phone || "Unknown";
  const needsReply =
    convo.status === "Open" || convo.status === "Pending";
  return {
    id: convo.id,
    name,
    phone: convo.phone || "",
    preview: convo.lastMessage?.trim() || "",
    time: new Date(convo.updatedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    unread: Boolean(convo.unread),
    needsReply,
    tag: convo.productSourceLabel ?? undefined,
    messages: (convo.messages ?? []).map(mapMessage),
    assignedTo: convo.assignedTo,
    consentLabel: consentLabelFromSource(convo.productSource),
    composerFooter: composerFooterFromThread(convo),
    missedCallEventId: convo.missedCallEventId ?? undefined,
  };
}
