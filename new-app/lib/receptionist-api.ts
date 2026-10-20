import type { AgentConfig } from "@/lib/agent";
import type { Call } from "@/lib/data";

export class ReceptionistDraftConflictError extends Error {
  constructor(message = "Draft was updated elsewhere. Reload and try again.") {
    super(message);
    this.name = "ReceptionistDraftConflictError";
  }
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    const message = json.error || res.statusText;
    if (res.status === 409 && String(message).includes("updated elsewhere")) {
      throw new ReceptionistDraftConflictError(message);
    }
    throw new Error(message);
  }
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
  const res = await fetch("/api/receptionist/publish", { method: "POST" });
  const json = (await res.json()) as {
    data?: { ok: boolean; errors?: string[]; state?: ReceptionistStateDto };
    error?: string;
  };
  const data = json.data ?? (json as { ok: boolean; errors?: string[]; state?: ReceptionistStateDto });
  if (res.status === 422 && data && typeof data === "object" && "ok" in data) {
    return data;
  }
  if (!res.ok) {
    throw new Error(json.error || res.statusText);
  }
  return data;
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

export async function fetchReceptionistKnowledgeFaqs() {
  return parse<
    { id: string; question: string; answer: string; status: string; updatedAt: string }[]
  >(await fetch("/api/receptionist/knowledge/faqs"));
}

export async function fetchReceptionistKnowledgeGaps() {
  return parse<
    {
      id: string;
      question: string;
      count: number;
      impact: string;
      lastCallId: string | null;
    }[]
  >(await fetch("/api/receptionist/knowledge/gaps"));
}

export async function fetchReceptionistKnowledgeSources() {
  return parse<
    { id: string; name: string; type: string; status: string; updatedAt: string }[]
  >(await fetch("/api/receptionist/knowledge/sources"));
}

export async function saveReceptionistFaq(input: {
  id?: string;
  question: string;
  answer: string;
}) {
  return parse(
    await fetch("/api/receptionist/knowledge/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function resolveReceptionistGap(gapId: string, answer: string) {
  return parse(
    await fetch("/api/receptionist/knowledge/gaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gapId, answer }),
    }),
  );
}

export async function addReceptionistWebsiteSource(url: string) {
  return parse(
    await fetch("/api/receptionist/knowledge/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "website", url }),
    }),
  );
}

export async function fetchReceptionistTestStatus() {
  return parse(await fetch("/api/receptionist/test/status"));
}

export async function startReceptionistLiveKitTest(version: "draft" | "live") {
  return parse<{
    sessionId: string;
    roomName: string;
    livekit: { url: string; token: string };
    agentId: string;
    version: string;
  }>(
    await fetch("/api/receptionist/test/livekit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    }),
  );
}
