import type { Conversation, Message } from "@/newui-transplant/lib/view-models";
import type { Conversation as ApiConversation } from "@/lib/types";
import type { InboxListItem } from "@/lib/inbox/kimi-inbox-adapter";
import { relativeAgo } from "@/lib/inbox/kimi-inbox-adapter";

/** Matches overview KPIs and missed-calls summary: OPEN + unread (MCTB product). */
export function mctbInboxNeedsReply(unread: boolean, status: string): boolean {
  return unread && status.toLowerCase() === "open";
}

function mapMessage(
  m: ApiConversation["messages"][number],
  urgentPreview?: string | null,
): Message {
  const text = m.body?.trim() || "";
  const time = m.at
    ? new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";
  const urgentReply =
    Boolean(urgentPreview) &&
    m.direction === "in" &&
    text.length > 0 &&
    (text === urgentPreview || urgentPreview.includes(text) || text.includes(urgentPreview));
  if (m.direction === "note") {
    return { from: "system", text, time };
  }
  if (m.direction === "in") {
    return { from: "customer", text, time, urgentReply };
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
  const needsReply = mctbInboxNeedsReply(row.unread, row.status || "");
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
    mctbUrgent: row.mctbUrgent?.isUrgent ? row.mctbUrgent : null,
  };
}

export function mapApiConversationToNewUiInbox(convo: ApiConversation): Conversation {
  const name = convo.contactName?.trim() || convo.phone || "Unknown";
  const needsReply = mctbInboxNeedsReply(Boolean(convo.unread), convo.status);
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
    messages: (convo.messages ?? []).map((m) =>
      mapMessage(m, convo.mctbUrgent?.messagePreview ?? null),
    ),
    consentLabel: consentLabelFromConversation(convo),
    composerFooter: composerFooterFromThread(convo),
    missedCallEventId: convo.missedCallEventId ?? undefined,
    mctbUrgent: convo.mctbUrgent?.isUrgent ? convo.mctbUrgent : null,
  };
}
