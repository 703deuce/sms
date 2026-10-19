import type { AgentConfig } from "@/lib/agent";
import type { Call } from "@/lib/data";

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return (json.data ?? json) as T;
}

export type ReceptionistStateDto = {
  agentId: string;
  live: AgentConfig;
  draft: AgentConfig;
  status: "active" | "paused" | "draft" | "publishing" | "sync_failed";
  draftRevision: number;
  publishedVersion: number | null;
  lastSaved: string | null;
  lastPublished: string | null;
  unsaved: boolean;
};

export async function fetchReceptionistState() {
  return parse<ReceptionistStateDto>(await fetch("/api/receptionist"));
}

export async function patchReceptionistDraft(
  editor: AgentConfig,
  expectedRevision?: number,
) {
  return parse<ReceptionistStateDto>(
    await fetch("/api/receptionist/draft", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editor, expectedRevision }),
    }),
  );
}

export async function publishReceptionist() {
  return parse<{ ok: boolean; errors?: string[]; state?: ReceptionistStateDto }>(
    await fetch("/api/receptionist/publish", { method: "POST" }),
  );
}

export async function pauseReceptionist() {
  return parse<ReceptionistStateDto>(await fetch("/api/receptionist/pause", { method: "POST" }));
}

export async function resumeReceptionist() {
  return parse<ReceptionistStateDto>(await fetch("/api/receptionist/resume", { method: "POST" }));
}

export async function discardReceptionistDraft() {
  return parse<ReceptionistStateDto>(
    await fetch("/api/receptionist/discard-draft", { method: "POST" }),
  );
}

export async function fetchReceptionistCalls(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return parse<{ data: Call[]; meta: { total: number } }>(
    await fetch(`/api/receptionist/calls?${q}`),
  );
}

export async function fetchReceptionistCall(id: string) {
  return parse<Call>(await fetch(`/api/receptionist/calls/${id}`));
}

export async function fetchReceptionistOverview() {
  return parse<Awaited<ReturnType<typeof import("@/lib/server/receptionist/overview-service").getReceptionistOverview>>>(
    await fetch("/api/receptionist/overview"),
  );
}

export async function fetchReceptionistAnalytics(from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  return parse(await fetch(`/api/receptionist/analytics?${q}`));
}

export async function fetchReceptionistReadiness() {
  return parse(await fetch("/api/receptionist/readiness"));
}
