/**
 * Data adapter: maps /api/contacts ↔ Kimi contacts mock types.
 */
import type { Contact as ApiContact } from "@/lib/types";
import type { Contact as KimiContact } from "@/components/kimi/contacts/mock-data";

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapOptIn(status: string): KimiContact["status"] {
  const s = status.toUpperCase();
  if (s === "SUBSCRIBED") return "Subscribed";
  if (s === "UNSUBSCRIBED") return "Unsubscribed";
  if (s === "BLOCKED") return "Blocked";
  return "Not Subscribed";
}

export function mapApiContactToKimi(c: ApiContact): KimiContact {
  return {
    id: c.id,
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    mobile: c.phone || "",
    email: c.email || "",
    status: mapOptIn(c.status),
    created: formatCreated(c.dateAdded || (c as { createdAt?: string }).createdAt || ""),
  };
}

export type KimiContactStats = { contacts: number; subscribed: number; unsubscribed: number };

export async function fetchContacts(): Promise<KimiContact[]> {
  const res = await fetch("/api/contacts?take=200");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load contacts");
  return (json.data || []).map((c: ApiContact) => mapApiContactToKimi(c));
}

export async function fetchContactStats(): Promise<KimiContactStats> {
  const [all, subscribed, unsubscribed] = await Promise.all([
    fetch("/api/contacts?take=1").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts?status=SUBSCRIBED&take=1").then((r) => (r.ok ? r.json() : { data: [] })),
    fetch("/api/contacts?status=UNSUBSCRIBED&take=1").then((r) => (r.ok ? r.json() : { data: [] })),
  ]);
  // API doesn't return total count in list response — use length of full fetch
  const full = await fetch("/api/contacts?take=200");
  const fullJson = await full.json();
  const rows = fullJson.data || [];
  const sub = rows.filter((c: ApiContact) => c.status?.toUpperCase() === "SUBSCRIBED").length;
  const unsub = rows.filter((c: ApiContact) => c.status?.toUpperCase() === "UNSUBSCRIBED").length;
  return { contacts: rows.length, subscribed: sub, unsubscribed: unsub };
}

export async function createContact(payload: {
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  status?: string;
}): Promise<void> {
  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create contact");
}

export async function importContacts(file: File): Promise<{ imported: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/contacts/import", { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Import failed");
  return { imported: json.data?.imported ?? json.data?.created ?? 0 };
}

export async function fetchContactLists(): Promise<string[]> {
  const res = await fetch("/api/contacts/lists");
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((l: { name: string }) => l.name);
}
