/**
 * Data adapter: maps /api/growth/keywords ↔ Kimi grow-keywords mock types.
 */
import type { Keyword } from "@/components/kimi/grow-keywords/mock-data";

function formatSaved(iso?: string): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return `Last saved on ${d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function mapApiKeywordToKimi(k: {
  id: string;
  keyword: string;
  confirmation?: string | null;
  listName?: string | null;
  autoReply?: string | null;
  status?: string;
  updatedAt?: string;
}): Keyword {
  return {
    id: k.id,
    name: k.keyword,
    description: k.confirmation || k.listName || "",
    lastSaved: formatSaved(k.updatedAt),
    connectedLists: k.listName ? 1 : 0,
    status: k.status === "Inactive" ? "Inactive" : "Active",
    autoReply: k.autoReply || undefined,
    listName: k.listName || undefined,
  };
}

export async function fetchKeywords(): Promise<Keyword[]> {
  const res = await fetch("/api/growth/keywords");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load keywords");
  return (json.data || []).map(mapApiKeywordToKimi);
}

export async function createKeyword(payload: {
  keyword: string;
  listName?: string;
  confirmation?: string;
  autoReply?: string;
  status?: string;
}): Promise<Keyword> {
  const res = await fetch("/api/growth/keywords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create keyword");
  return mapApiKeywordToKimi(json.data);
}

export async function updateKeyword(
  id: string,
  payload: {
    keyword?: string;
    listName?: string;
    confirmation?: string;
    autoReply?: string;
    status?: string;
  },
): Promise<Keyword> {
  const res = await fetch(`/api/growth/keywords/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update keyword");
  return mapApiKeywordToKimi(json.data);
}

export async function deleteKeyword(id: string): Promise<void> {
  const res = await fetch(`/api/growth/keywords/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Could not delete keyword");
  }
}

export async function cloneKeyword(id: string, keywords: Keyword[]): Promise<Keyword> {
  const src = keywords.find((k) => k.id === id);
  if (!src) throw new Error("Keyword not found");
  const base = `${src.name}Copy`.replace(/Copy+$/, "");
  let candidate = `${base}Copy`;
  const existing = new Set(keywords.map((k) => k.name.toUpperCase()));
  while (existing.has(candidate.toUpperCase())) {
    candidate = `${candidate}Copy`;
  }
  return createKeyword({
    keyword: candidate,
    confirmation: src.description || undefined,
  });
}

export async function fetchContactListNames(): Promise<string[]> {
  const res = await fetch("/api/contacts/lists");
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((l: { name: string }) => l.name);
}
