/**
 * Data adapter: maps /api/auto-replies ↔ Kimi auto-replies mock types.
 */
import type { AutoReplyRecord } from "@/lib/auto-replies/types";
import { autoReplyTriggerLabel } from "@/lib/auto-replies/types";
import type { Keyword, OptInMessage } from "@/components/kimi/auto-replies/mock-data";

function formatSaved(iso?: string): string {
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

export function mapAutoReplyToKimiKeyword(r: AutoReplyRecord): Keyword {
  return {
    id: r.id,
    keyword: r.name || r.triggerType,
    lastSaved: formatSaved(r.updatedAt),
    description: autoReplyTriggerLabel(r.triggerType, r.triggerConfig),
    connectedLists: r.triggerConfig?.listName ? 1 : 0,
    createsContacts: true,
    autoResponse: r.message || "",
  };
}

export async function fetchAutoReplies(): Promise<AutoReplyRecord[]> {
  const res = await fetch("/api/auto-replies");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load auto-replies");
  return json.data || [];
}

export async function updateAutoReply(
  id: string,
  patch: Partial<{ name: string; message: string; enabled: boolean }>,
): Promise<AutoReplyRecord> {
  const res = await fetch(`/api/auto-replies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not update auto-reply");
  return json.data;
}

export async function createAutoReply(payload: {
  name: string;
  triggerType: string;
  triggerConfig?: Record<string, string | undefined>;
  message: string;
}): Promise<AutoReplyRecord> {
  const res = await fetch("/api/auto-replies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      triggerType: payload.triggerType,
      triggerConfig: payload.triggerConfig,
      message: payload.message,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create auto-reply");
  return json.data;
}

// Opt-in messages use workspace messaging settings — stub mapping for Kimi UI
export function defaultOptInMessages(): OptInMessage[] {
  return [
    { id: "1", title: "Single Opt-In", description: "", body: "You're subscribed! Reply STOP to opt out.", editable: true },
    { id: "2", title: "Double Opt-In", description: "", body: "Reply YES to confirm your subscription.", editable: true },
  ];
}
