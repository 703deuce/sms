/**
 * Data adapter: maps /api/contacts/lists ↔ Kimi contacts-lists mock types.
 */
import type { ContactListSummary } from "@/lib/workspace-data";
import type { ContactList, Contact, Keyword } from "@/components/kimi/contacts-lists/mock-data";
import { mapApiContactToKimi } from "./kimi-contacts-adapter";
import type { Contact as ApiContact } from "@/lib/types";

function formatCreated(iso?: string): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function mapApiListToKimi(
  l: Partial<ContactListSummary> & { id: string; name: string; description?: string | null },
): ContactList {
  return {
    id: l.id,
    name: l.name,
    description: l.description || "",
    created: formatCreated(),
    contacts: l.contactCount ?? 0,
  };
}

export function mapApiKeywordToKimi(k: {
  id: string;
  keyword: string;
  listName?: string | null;
  confirmation?: string | null;
  autoReply?: string | null;
  updatedAt?: string;
}): Keyword {
  return {
    id: k.id,
    keyword: k.keyword,
    description: k.confirmation || k.listName || "",
    lastSaved: formatCreated(k.updatedAt),
    connectedLists: k.listName ? 1 : 0,
    createsContacts: true,
    autoResponse: k.autoReply || "",
    listName: k.listName || undefined,
  };
}

export async function fetchLists(): Promise<ContactList[]> {
  const res = await fetch("/api/contacts/lists");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load lists");
  return (json.data || []).map((l: ContactListSummary) => mapApiListToKimi(l));
}

export async function createList(name: string, description: string): Promise<ContactList> {
  const res = await fetch("/api/contacts/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create list");
  return mapApiListToKimi(json.data);
}

export async function fetchContactsForLists(): Promise<Contact[]> {
  const res = await fetch("/api/contacts?take=200");
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((c: ApiContact) => {
    const mapped = mapApiContactToKimi(c);
    return {
      id: mapped.id,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      mobile: mapped.mobile,
      email: mapped.email,
      optIn: mapped.status === "Subscribed" ? "Subscribed" : "Not Subscribed",
      created: mapped.created,
    } satisfies Contact;
  });
}

export async function fetchKeywordsForLists(): Promise<Keyword[]> {
  const res = await fetch("/api/growth/keywords");
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((k: {
    id: string;
    keyword: string;
    listName?: string;
    confirmation?: string;
    autoReply?: string;
    updatedAt?: string;
  }) => mapApiKeywordToKimi(k));
}

export async function addContactsToList(listId: string, contactIds: string[]): Promise<void> {
  const res = await fetch("/api/contacts/lists", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: listId, addContactIds: contactIds }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not add contacts to list");
}

export async function updateKeywordForList(
  keywordId: string,
  payload: { listName?: string; keyword?: string; confirmation?: string; autoReply?: string },
): Promise<Keyword> {
  const res = await fetch(`/api/growth/keywords/${keywordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not save keyword");
  return mapApiKeywordToKimi(json.data);
}
