/**
 * Data adapter: maps /api/inbox ↔ Kimi conversations mock types.
 * Lives outside Kimi UI — presentation components stay untouched.
 */
import type { Conversation as ApiConversation, User } from "@/lib/types";
import type { Conversation, Message, Tag, Teammate } from "@/lib/inbox/conversation-types";
import type { InboxPermissionsJson, InboxTagDefinition } from "@/lib/messaging/messaging-settings";
import { resolveInboxPermissions } from "@/lib/messaging/messaging-settings";
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
  if (s === "snoozed") return "snoozed";
  if (s === "spam") return "spam";
  if (s === "closed") return "closed";
  return "open";
}

export function kimiStatusToApi(status: Conversation["status"]): string {
  if (status === "pending") return "Pending";
  if (status === "closed") return "Closed";
  if (status === "snoozed") return "Snoozed";
  if (status === "spam") return "Spam";
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
  const body = m.body || "";
  const media = m.mediaUrls?.filter(Boolean) ?? [];
  if (m.direction === "note") {
    return {
      id: m.id,
      kind: "note",
      author: m.user ? `Note From ${m.user}` : "Note",
      text: body,
      time: formatMessageTime(m.at),
    };
  }
  const outbound = m.direction === "out";
  const isAi = outbound && (m.user === "AI" || m.user?.toLowerCase().includes("ai "));
  if (media.length > 0) {
    return {
      id: m.id,
      kind: "mms",
      author: outbound ? (isAi ? "AI" : m.user || "Me") : contactName,
      initials: outbound ? undefined : initials(contactName),
      image: media[0],
      images: media,
      caption: body || undefined,
      time: formatMessageTime(m.at),
      isAi,
    };
  }
  const isMediaPlaceholder =
    body === "[Media attachment]" || body.startsWith("[Inbound MMS") || body.startsWith("[MMS");
  if (isMediaPlaceholder) {
    return {
      id: m.id,
      kind: "mms",
      author: outbound ? (isAi ? "AI" : m.user || "Me") : contactName,
      initials: outbound ? undefined : initials(contactName),
      caption: body,
      time: formatMessageTime(m.at),
      isAi,
    };
  }
  return {
    id: m.id,
    kind: outbound ? "outbound" : "inbound",
    author: outbound ? (isAi ? "AI" : m.user || "Me") : contactName,
    initials: outbound ? undefined : initials(contactName),
    text: body,
    time: formatMessageTime(m.at),
    isAi,
  };
}

export function mapApiConversationToKimi(
  c: ApiConversation,
  ctx: KimiInboxContext,
  tagCatalog: Tag[] = [],
  tagDefinitions: InboxTagDefinition[] = [],
): Conversation {
  const name = c.contactName || c.phone || "Unknown";
  return {
    id: c.id,
    contactId: c.contactId,
    name,
    initials: initials(name),
    color: hashColor(name),
    preview: c.lastMessage || "",
    ago: relativeAgo(c.updatedAt),
    unread: c.unread,
    status: apiStatusToKimi(c.status),
    assignee: resolveAssigneeId(c.assignedTo, ctx),
    tags: apiTagNamesToKeys(c.tags || [], tagCatalog, tagDefinitions),
    phone: c.phone,
    messages: (c.messages || []).map((m) => mapApiMessage(m, name)),
    productSource: c.productSource ?? null,
    productSourceLabel: c.productSourceLabel ?? null,
    campaignId: c.campaignId ?? null,
    campaignName: c.campaignName ?? null,
    fromE164: c.fromE164 ?? null,
    repeatCaller: c.repeatCaller,
  };
}

export function mapListItemToKimi(
  item: InboxListItem,
  ctx: KimiInboxContext,
  tagCatalog: Tag[] = [],
  tagDefinitions: InboxTagDefinition[] = [],
): Conversation {
  const first = item.contact?.firstName || "";
  const last = item.contact?.lastName || "";
  const name = `${first} ${last}`.trim() || item.contact?.phone || "Unknown";
  return {
    id: item.id,
    contactId: item.contact?.id,
    name,
    initials: initials(name),
    color: hashColor(name),
    preview: item.lastMessage || "",
    ago: relativeAgo(item.updatedAt),
    unread: item.unread,
    status: apiStatusToKimi(item.status),
    assignee: resolveAssigneeId(item.assignedTo, ctx),
    tags: apiTagNamesToKeys(item.tags || [], tagCatalog, tagDefinitions),
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

/** Conversation tags in the API are stored by name — Kimi tag ids must match names. */
export function canonicalTagId(name: string): string {
  return name;
}

export function buildTagsFromConversations(convos: Conversation[]): Tag[] {
  const names = new Set<string>();
  for (const c of convos) {
    for (const t of c.tags) names.add(t);
  }
  return Array.from(names).map((name, i) => ({
    id: canonicalTagId(name),
    name,
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    description: "",
    created: "",
    untagOnClose: false,
  }));
}

export function inboxTagDefinitionsToKimi(rows: InboxTagDefinition[]): Tag[] {
  return rows.map((r, i) => ({
    id: canonicalTagId(r.name),
    name: r.name,
    color: r.color || AVATAR_COLORS[i % AVATAR_COLORS.length],
    description: r.description || "",
    created: r.created || "",
    untagOnClose: r.untagOnClose ?? false,
  }));
}

export function mergeTagCatalog(persisted: Tag[], fromConvos: Tag[]): Tag[] {
  const byName = new Map<string, Tag>();
  for (const t of [...persisted, ...fromConvos]) {
    byName.set(t.name, { ...t, id: canonicalTagId(t.name) });
  }
  return Array.from(byName.values());
}

/** Resolve a Kimi tag key (id or legacy persisted id) to the API tag name. */
export function tagKeyToApiName(tagKey: string, catalog: Tag[]): string {
  const byId = catalog.find((t) => t.id === tagKey);
  if (byId) return byId.name;
  const byName = catalog.find((t) => t.name === tagKey);
  if (byName) return byName.name;
  return tagKey;
}

export function tagKeysToApiNames(tagKeys: string[], catalog: Tag[]): string[] {
  return Array.from(new Set(tagKeys.map((k) => tagKeyToApiName(k, catalog))));
}

/** Map API tag names onto canonical Kimi tag keys. */
export function apiTagNamesToKeys(
  tagNames: string[],
  catalog: Tag[],
  definitions: InboxTagDefinition[] = [],
): string[] {
  return tagNames.map((raw) => {
    const legacy = definitions.find((d) => d.id === raw);
    const name = legacy?.name ?? raw;
    const hit = catalog.find((t) => t.name === name || t.id === name);
    return hit ? hit.id : canonicalTagId(name);
  });
}

export function resolveInboxPerms(json: InboxPermissionsJson | null | undefined) {
  return resolveInboxPermissions(json);
}

export type InboxQuery = {
  filter?: "mine" | "unassigned" | "unread" | "archived";
  unread?: boolean;
  product?: string;
  status?: "open" | "pending" | "closed" | "snoozed" | "spam";
  assigneeId?: string;
  contactId?: string;
  tag?: string;
  phoneNumberId?: string;
  campaignId?: string;
  q?: string;
  take?: number;
  cursor?: string;
};

export type InboxListPage = {
  rows: InboxListItem[];
  pagination: {
    take: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export function inboxQueryFromFilter(
  sel: FilterSel,
  product = "all",
  extra: Pick<InboxQuery, "phoneNumberId" | "campaignId" | "q" | "take" | "cursor"> = {},
): InboxQuery {
  const q: InboxQuery = {
    product: product === "all" ? "all" : product,
    ...extra,
  };
  if (sel.kind === "mine") {
    q.filter = "mine";
    if (sel.key === "unread") q.unread = true;
    if (sel.key === "open" || sel.key === "pending" || sel.key === "snoozed" || sel.key === "spam") {
      q.status = sel.key;
    }
  } else if (sel.kind === "all") {
    if (sel.key === "unassigned") q.filter = "unassigned";
    else if (sel.key === "unread") q.unread = true;
    else if (
      sel.key === "open" ||
      sel.key === "pending" ||
      sel.key === "closed" ||
      sel.key === "snoozed" ||
      sel.key === "spam"
    ) {
      q.status = sel.key;
    }
  } else if (sel.kind === "teammate") {
    q.assigneeId = sel.key;
    if (sel.sub === "open" || sel.sub === "pending" || sel.sub === "snoozed" || sel.sub === "spam") {
      q.status = sel.sub;
    }
  } else if (sel.kind === "tag") {
    q.tag = sel.key;
    if (sel.sub === "open" || sel.sub === "pending" || sel.sub === "closed" || sel.sub === "snoozed" || sel.sub === "spam") {
      q.status = sel.sub;
    }
  }
  return q;
}

export async function fetchInboxListPage(query: InboxQuery = { product: "all" }): Promise<InboxListPage> {
  const params = new URLSearchParams();
  params.set("product", query.product || "all");
  if (query.filter) params.set("filter", query.filter);
  if (query.unread) params.set("unread", "1");
  if (query.status) params.set("status", query.status);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  if (query.contactId) params.set("contactId", query.contactId);
  if (query.tag) params.set("tag", query.tag);
  if (query.phoneNumberId) params.set("phoneNumberId", query.phoneNumberId);
  if (query.campaignId) params.set("campaignId", query.campaignId);
  if (query.q) params.set("q", query.q);
  if (query.take) params.set("take", String(query.take));
  if (query.cursor) params.set("cursor", query.cursor);
  const res = await fetch(`/api/inbox?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load conversations");
  return {
    rows: json.data || [],
    pagination: json.pagination || { take: 50, hasMore: false, nextCursor: null },
  };
}

export async function fetchInboxList(query: InboxQuery = { product: "all" }): Promise<InboxListItem[]> {
  const page = await fetchInboxListPage(query);
  return page.rows;
}

export async function fetchConversationForContact(contactId: string): Promise<ApiConversation | null> {
  const rows = await fetchInboxList({ product: "all", contactId });
  if (!rows.length) return null;
  return fetchConversation(rows[0]!.id);
}

export async function fetchContactById(contactId: string): Promise<import("@/lib/types").Contact | null> {
  const res = await fetch(`/api/contacts/${contactId}`);
  const json = await res.json();
  if (!res.ok || !json.data) return null;
  return json.data;
}

export async function fetchContactSummary(
  contactId: string,
): Promise<{ id: string; name: string; phone: string } | null> {
  const res = await fetch(`/api/contacts/${contactId}`);
  const json = await res.json();
  if (!res.ok || !json.data) return null;
  const c = json.data;
  return {
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "Contact",
    phone: c.phone,
  };
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
  fromE164?: string;
  mediaUrls?: string[];
  inboxCompose?: boolean;
}): Promise<void> {
  const res = await fetch("/api/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: input.to,
      message: input.message,
      from: input.fromE164,
      mediaUrls: input.mediaUrls,
      inboxCompose: input.inboxCompose,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not send message");
}

export function downloadTranscript(convo: Conversation) {
  const lines = convo.messages
    .filter((m) => m.kind === "inbound" || m.kind === "outbound" || m.kind === "note" || m.kind === "mms")
    .map((m) => {
      const who = m.kind === "inbound" ? convo.name : m.author || "You";
      let mediaNote = "";
      if (m.kind === "mms") {
        const urls = m.images?.length ? m.images : m.image ? [m.image] : [];
        mediaNote = urls.length ? ` [MMS: ${urls.join(", ")}]` : " [MMS]";
      }
      const text = m.text || m.caption || "";
      return `[${m.time}] ${who}: ${text}${mediaNote}`;
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
  tagCatalog: Tag[] = [],
  opts?: { fromE164?: string },
): Promise<ApiConversation | null> {
  if (next.messages.length > prev.messages.length) {
    const added = next.messages[next.messages.length - 1];
    if ((added.kind === "outbound" || added.kind === "mms") && (added.text || added.caption || added.image)) {
      const mediaUrls = added.images?.length ? added.images : added.image ? [added.image] : undefined;
      const body = (added.text || added.caption || "").trim();
      if (!body && !mediaUrls?.length) return null;
      return patchConversation(prev.id, {
        action: "reply",
        body,
        mediaUrls,
        from: opts?.fromE164,
      });
    }
    if (added.kind === "note" && added.text) {
      return patchConversation(prev.id, { action: "note", body: added.text });
    }
  }

  const patch: Record<string, unknown> = {};
  if (next.status !== prev.status) {
    patch.status = kimiStatusToApi(next.status);
  }
  if (next.assignee !== prev.assignee) {
    patch.assigneeId = resolveAssigneeApiId(next.assignee, ctx);
  }
  const tagsChanged =
    next.tags.length !== prev.tags.length || next.tags.some((t, i) => t !== prev.tags[i]);
  if (tagsChanged) {
    patch.tags = tagKeysToApiNames(next.tags, tagCatalog);
  }
  if (next.unread !== prev.unread) {
    patch.unread = next.unread;
  }
  if (Object.keys(patch).length === 0) return null;
  return patchConversation(prev.id, patch);
}
