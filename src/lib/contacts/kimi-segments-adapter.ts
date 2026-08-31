/**
 * Data adapter: maps /api/contacts/segments ↔ Kimi contacts-segments mock types.
 */
import type { SegmentSummary } from "@/lib/workspace-data";
import type { Segment } from "@/components/kimi/contacts-segments/mock-data";

export function mapApiSegmentToKimi(
  s: SegmentSummary & { createdAt?: string; conditions?: unknown },
  contactCount = 0,
): Segment {
  return {
    id: s.id,
    name: s.name,
    conditions: s.conditions,
    createdAt: s.createdAt
      ? new Date(s.createdAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Recently",
    contacts: contactCount,
  };
}

export async function fetchSegments(): Promise<Segment[]> {
  const res = await fetch("/api/contacts/segments");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load segments");
  const rows = (json.data || []) as Array<SegmentSummary & { createdAt?: string; conditions?: unknown }>;
  const withCounts = await Promise.all(
    rows.map(async (s) => {
      const count = await previewSegmentCount(s.conditions ?? { match: "all", rules: [] });
      return mapApiSegmentToKimi(s, count);
    }),
  );
  return withCounts;
}

export async function previewSegmentCount(conditions: unknown): Promise<number> {
  const res = await fetch("/api/contacts/segments/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conditions }),
  });
  const json = await res.json();
  if (!res.ok) return 0;
  return json.data?.count ?? 0;
}

export async function createSegment(name: string, conditions: unknown): Promise<Segment> {
  const res = await fetch("/api/contacts/segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, conditions }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create segment");
  const count = await previewSegmentCount(conditions);
  return mapApiSegmentToKimi(json.data, count);
}

export async function updateSegment(id: string, name: string, conditions: unknown): Promise<Segment> {
  const res = await fetch("/api/contacts/segments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, conditions }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update segment");
  const count = await previewSegmentCount(conditions);
  return mapApiSegmentToKimi(json.data, count);
}

export async function deleteSegment(id: string): Promise<void> {
  const res = await fetch(`/api/contacts/segments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not delete segment");
}

export type SegmentContactRow = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  state: string;
  age: number | null;
  status: "Subscribed" | "Unsubscribed" | "Blocked" | "Not Subscribed";
};

export async function fetchSegmentContacts(
  segmentId: string,
  take = 200,
): Promise<{ contacts: SegmentContactRow[]; total: number }> {
  const res = await fetch("/api/contacts/segments/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segmentId, take }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load segment contacts");
  return {
    contacts: json.data?.contacts ?? [],
    total: json.data?.total ?? 0,
  };
}
