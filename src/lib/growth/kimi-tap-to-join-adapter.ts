/**
 * Data adapter: maps /api/growth/tap-to-join ↔ Kimi grow-tap-to-join mock types.
 */
import type { TapLink, Keyword } from "@/components/kimi/grow-tap-to-join/mock-data";
import { mapApiKeywordToKimi, fetchKeywords } from "./kimi-keywords-adapter";

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

export function mapTapToJoinToKimi(row: {
  id: string;
  name: string;
  keyword?: string | null;
  phoneE164?: string;
  clicks?: number;
  joinCount?: number;
  createdAt?: string;
  href?: string;
  status?: string;
}): TapLink {
  return {
    id: row.id,
    name: row.name,
    keyword: row.keyword || "",
    number: row.phoneE164 || "",
    fallbackUrl: "",
    status: row.status === "Inactive" ? "Inactive" : "Active",
    createdAt: formatCreated(row.createdAt),
    all: row.clicks ?? 0,
    unique: row.joinCount ?? 0,
    bot: 0,
    url: row.href || "",
  };
}

export async function fetchTapLinks(): Promise<TapLink[]> {
  const res = await fetch("/api/growth/tap-to-join");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load tap-to-join links");
  return (json.data || []).map(mapTapToJoinToKimi);
}

export async function createTapLink(payload: {
  name: string;
  keywordId?: string;
  keyword?: string;
  phoneE164?: string;
  body?: string;
}): Promise<TapLink> {
  let keywordId = payload.keywordId;
  if (!keywordId && payload.keyword) {
    const keywords = await fetchKeywords();
    const match = keywords.find(
      (k) => k.name.toUpperCase() === payload.keyword!.trim().toUpperCase(),
    );
    keywordId = match?.id;
  }
  if (!keywordId) {
    throw new Error("Select a keyword that exists in your workspace");
  }

  const res = await fetch("/api/growth/tap-to-join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      keywordId,
      phoneE164: payload.phoneE164,
      buttonText: payload.body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create tap-to-join link");
  return mapTapToJoinToKimi(json.data);
}

export async function updateTapLink(
  id: string,
  payload: {
    name?: string;
    keyword?: string;
    keywordId?: string;
    phoneE164?: string;
    status?: "Active" | "Inactive";
  },
): Promise<TapLink> {
  let keywordId = payload.keywordId;
  if (!keywordId && payload.keyword) {
    const keywords = await fetchKeywords();
    const match = keywords.find(
      (k) => k.name.toUpperCase() === payload.keyword!.trim().toUpperCase(),
    );
    keywordId = match?.id;
  }

  const res = await fetch(`/api/growth/tap-to-join/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      keywordId,
      status: payload.status === "Inactive" ? "Paused" : payload.status === "Active" ? "Active" : undefined,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update link");
  return mapTapToJoinToKimi(json.data);
}

export async function deleteTapLink(id: string): Promise<void> {
  const res = await fetch(`/api/growth/tap-to-join/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Could not delete link");
  }
}

export async function fetchTapKeywords(): Promise<Keyword[]> {
  const rows = await fetchKeywords();
  return rows.map((k) => ({
    id: k.id,
    keyword: k.name,
    description: k.description,
    lastSaved: k.lastSaved,
    connectedLists: k.connectedLists,
    status: k.status,
  }));
}

export { mapApiKeywordToKimi };
