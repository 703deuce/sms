import type { Conversation, Message } from "@/newui-transplant/lib/view-models";
import type { Conversation as ApiConversation } from "@/lib/types";
import type { InboxListItem } from "@/lib/inbox/kimi-inbox-adapter";
import { relativeAgo } from "@/lib/inbox/kimi-inbox-adapter";

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

function consentLabelFromConversation(convo: ApiConversation): string {
  const tags = (convo.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => t.includes("opted_out") || t === "opt_out" || t === "stop")) {
    return "Opted out";
  }
  return "—";
}

function composerFooterFromThread(convo: ApiConversation): string {
  const segments = Math.max(1, Math.ceil((convo.lastMessage?.length || 0) / 160));
  const blocked = convo.tags?.includes("opted_out");
  const eligibility = blocked ? "Customer has opted out" : "Customer has not opted out";
  return `${convo.lastMessage?.length ?? 0} / 160 · ${segments} segment · ${eligibility}`;
}

/** Row-level inbox list item — no full thread (Tier 1 conversations list). */
export function mapInboxListItemToNewUiInbox(row: InboxListItem): Conversation {
  const name =
    [row.contact?.firstName, row.contact?.lastName].filter(Boolean).join(" ") ||
    row.contact?.phone ||
    row.fromE164 ||
    "Unknown";
  const phone = row.contact?.phone || row.fromE164 || "";
  const status = (row.status || "").toLowerCase();
  const needsReply = row.unread && (status === "open" || status === "pending");
  return {
    id: row.id,
    name,
    phone,
    preview: row.lastMessage?.trim() || "",
    time: relativeAgo(row.updatedAt),
    unread: Boolean(row.unread),
    needsReply,
    tag: row.productSourceLabel ?? undefined,
    messages: [],
    consentLabel: "—",
    composerFooter: "",
    missedCallEventId: row.missedCallEventId ?? undefined,
  };
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
    consentLabel: consentLabelFromConversation(convo),
    composerFooter: composerFooterFromThread(convo),
    missedCallEventId: convo.missedCallEventId ?? undefined,
  };
}
