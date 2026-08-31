/**
 * Data adapter: maps /api/inbox ↔ Kimi conversations mock types.
 * Lives outside Kimi UI — presentation components stay untouched.
 */
import type { Conversation as ApiConversation, User } from "@/lib/types";
import type { Conversation, Message, Tag, Teammate } from "@/components/kimi/conversations/mock-data";
import type { FilterSel } from "@/components/kimi/conversations/components/InboxRail";

const AVATAR_COLORS = ["#14b8a6", "#6366f1", "#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6"];

export type InboxListItem = {
  id: string;
  status: string;
  unread: boolean;
  assignedTo: string | null;
  contact: {
    id: string;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  lastMessage: string;
  updatedAt: string;
  tags?: string[];
};

export type KimiInboxContext = {
  currentUserId: string;
  currentUserName: string;
  teamMembers: User[];
};

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function relativeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "An Hour Ago" : `${hrs} Hours Ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "A Day Ago" : `${days} Days Ago`;
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function apiStatusToKimi(status: string): Conversation["status"] {
  const s = status.toLowerCase();
  if (s === "pending") return "pending";
  if (s === "closed" || s === "spam" || s === "snoozed") return "closed";
  return "open";
}

export function kimiStatusToApi(status: Conversation["status"]): string {
  if (status === "pending") return "Pending";
  if (status === "closed") return "Closed";
  return "Open";
}

export function resolveAssigneeId(
  assignedTo: string | null | undefined,
  ctx: KimiInboxContext,
): string | null {
  if (!assignedTo) return null;
  if (assignedTo === ctx.currentUserName) return "me";
  const member = ctx.teamMembers.find((m) => m.name === assignedTo);
  return member?.id ?? null;
}

export function resolveAssigneeApiId(
  assigneeId: string | null,
  ctx: KimiInboxContext,
): string | null {
  if (!assigneeId) return null;
  if (assigneeId === "me") return ctx.currentUserId;
  return assigneeId;
}

function mapApiMessage(m: ApiConversation["messages"][number], contactName: string): Message {
  if (m.direction === "note") {
    return {
      id: m.id,
      kind: "note",
      author: m.user ? `Note From ${m.user}` : "Note",
      text: m.body,
      time: formatMessageTime(m.at),
    };
  }
  const outbound = m.direction === "out";
  return {
    id: m.id,
    kind: outbound ? "outbound" : "inbound",
    author: outbound ? (m.user || "Me") : contactName,
    initials: outbound ? undefined : initials(contactName),
    text: m.body,
    time: formatMessageTime(m.at),
  };
}

export function mapApiConversationToKimi(c: ApiConversation, ctx: KimiInboxContext): Conversation {
  const name = c.contactName || c.phone || "Unknown";
  return {
    id: c.id,
    name,
    initials: initials(name),
    color: hashColor(name),
    preview: c.lastMessage || "",
    ago: relativeAgo(c.updatedAt),
    unread: c.unread,
    status: apiStatusToKimi(c.status),
    assignee: resolveAssigneeId(c.assignedTo, ctx),
    tags: c.tags || [],
    phone: c.phone,
    messages: (c.messages || []).map((m) => mapApiMessage(m, name)),
  };
}

export function mapListItemToKimi(item: InboxListItem, ctx: KimiInboxContext): Conversation {
  const first = item.contact?.firstName || "";
  const last = item.contact?.lastName || "";
  const name = `${first} ${last}`.trim() || item.contact?.phone || "Unknown";
  return {
    id: item.id,
    name,
    initials: initials(name),
    color: hashColor(name),
    preview: item.lastMessage || "",
    ago: relativeAgo(item.updatedAt),
    unread: item.unread,
    status: apiStatusToKimi(item.status),
    assignee: resolveAssigneeId(item.assignedTo, ctx),
    tags: item.tags || [],
    phone: item.contact?.phone || "",
    messages: [],
  };
}

export function buildTeammates(ctx: KimiInboxContext): Teammate[] {
  const me: Teammate = {
    id: "me",
    name: "Me",
    initials: initials(ctx.currentUserName || "Me"),
    color: "#4f46e5",
  };
  const others = ctx.teamMembers
    .filter((m) => m.id !== ctx.currentUserId)
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: initials(m.name),
      color: hashColor(m.name),
    }));
  return [me, ...others];
}

export function buildTagsFromConversations(convos: Conversation[]): Tag[] {
  const names = new Set<string>();
  for (const c of convos) {
    for (const t of c.tags) names.add(t);
  }
  return Array.from(names).map((name, i) => ({
    id: name,
    name,
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    description: "",
    created: "",
    untagOnClose: false,
  }));
}

export type InboxQuery = {
  filter?: "mine" | "unassigned" | "unread" | "archived";
  unread?: boolean;
  product?: string;
};

export function inboxQueryFromFilter(sel: FilterSel): InboxQuery {
  const q: InboxQuery = { product: "all" };
  if (sel.kind === "mine") {
    q.filter = "mine";
    if (sel.key === "unread") q.unread = true;
  } else if (sel.kind === "all") {
    if (sel.key === "unassigned") q.filter = "unassigned";
    else if (sel.key === "unread") q.unread = true;
  }
  return q;
}

export async function fetchInboxList(query: InboxQuery = { product: "all" }): Promise<InboxListItem[]> {
  const params = new URLSearchParams();
  params.set("product", query.product || "all");
  if (query.filter) params.set("filter", query.filter);
  if (query.unread) params.set("unread", "1");
  const res = await fetch(`/api/inbox?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load conversations");
  return json.data || [];
}

export async function fetchConversation(id: string): Promise<ApiConversation> {
  const res = await fetch(`/api/inbox/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load conversation");
  return json.data;
}

export async function patchConversation(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiConversation> {
  const res = await fetch(`/api/inbox/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update conversation");
  return json.data;
}

export async function searchContacts(query: string): Promise<Array<{ id: string; name: string; phone: string }>> {
  const params = new URLSearchParams({ take: "20" });
  if (query.trim()) params.set("q", query.trim());
  const res = await fetch(`/api/contacts?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((c: { id: string; firstName?: string; lastName?: string; phone: string }) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
    phone: c.phone,
  }));
}

export async function sendNewMessage(input: {
  to: string;
  message: string;
  numberId?: string;
  mediaUrls?: string[];
}): Promise<void> {
  const res = await fetch("/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: input.to,
      message: input.message,
      from: input.numberId,
      mediaUrls: input.mediaUrls,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not send message");
}

export function downloadTranscript(convo: Conversation) {
  const lines = convo.messages
    .filter((m) => m.kind === "inbound" || m.kind === "outbound" || m.kind === "note")
    .map((m) => {
      const who = m.kind === "inbound" ? convo.name : m.author || "You";
      return `[${m.time}] ${who}: ${m.text || ""}`;
    });
  const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${convo.name.replace(/\s+/g, "-")}-transcript.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sync Kimi optimistic ThreadView update → API patch. */
export async function syncConversationUpdate(
  prev: Conversation,
  next: Conversation,
  ctx: KimiInboxContext,
): Promise<ApiConversation | null> {
  if (next.messages.length > prev.messages.length) {
    const added = next.messages[next.messages.length - 1];
    if (added.kind === "outbound" && added.text) {
      return patchConversation(prev.id, { action: "reply", body: added.text });
    }
    if (added.kind === "note" && added.text) {
      return patchConversation(prev.id, { action: "note", body: added.text });
    }
  }
  if (next.status !== prev.status) {
    return patchConversation(prev.id, { status: kimiStatusToApi(next.status) });
  }
  if (next.assignee !== prev.assignee) {
    return patchConversation(prev.id, {
      assigneeId: resolveAssigneeApiId(next.assignee, ctx),
    });
  }
  const tagsChanged =
    next.tags.length !== prev.tags.length || next.tags.some((t, i) => t !== prev.tags[i]);
  if (tagsChanged) {
    return patchConversation(prev.id, { tags: next.tags });
  }
  if (next.unread !== prev.unread) {
    return patchConversation(prev.id, { unread: next.unread });
  }
  return null;
}
