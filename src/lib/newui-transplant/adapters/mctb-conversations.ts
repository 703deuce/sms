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
  return { from: "business", text, time };
}

export function mapApiConversationToNewUiInbox(convo: ApiConversation): Conversation {
  const name = convo.contactName?.trim() || convo.phone || "Unknown";
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
    needsReply: convo.status === "Open",
    messages: (convo.messages ?? []).map(mapMessage),
  };
}
