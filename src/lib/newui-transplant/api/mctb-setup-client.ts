import {
  parseMctbHandoffResponse,
  type MctbHandoffPayload,
} from "@/lib/mctb/handoff/parse-handoff-response";

export type { MctbHandoffPayload };

let setupInflight: Promise<Record<string, unknown>> | null = null;
let setupCache: { at: number; data: Record<string, unknown> } | null = null;
const SETUP_CACHE_MS = 8_000;

export async function fetchMctbSetup(options?: { force?: boolean }): Promise<Record<string, unknown>> {
  const force = options?.force === true;
  const now = Date.now();
  if (!force && setupCache && now - setupCache.at < SETUP_CACHE_MS) {
    return setupCache.data;
  }
  if (!force && setupInflight) {
    return setupInflight;
  }
  setupInflight = (async () => {
    const res = await fetch("/api/mctb/setup", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load MCTB setup");
    const json = (await res.json()) as { data?: Record<string, unknown> };
    const data = (json.data ?? json) as Record<string, unknown>;
    setupCache = { at: Date.now(), data };
    return data;
  })().finally(() => {
    setupInflight = null;
  });
  return setupInflight;
}

export async function saveMctbSetup(patch: Record<string, unknown>): Promise<void> {
  setupCache = null;
  const res = await fetch("/api/mctb/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || "Save failed");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mctb-setup-updated"));
  }
}

export async function fetchMctbExclusions(): Promise<unknown[]> {
  const res = await fetch("/api/mctb/exclusions", { cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((j as { error?: string }).error || "Could not load exclusions");
  }
  return (j.data ?? j.exclusions ?? []) as unknown[];
}

export async function addMctbExclusion(input: { phoneE164: string; label?: string }): Promise<void> {
  const res = await fetch("/api/mctb/exclusions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneE164: input.phoneE164,
      phone: input.phoneE164,
      label: input.label,
      reason: input.label,
    }),
  });
  if (!res.ok) throw new Error("Could not add exclusion");
}

export async function deleteMctbExclusion(id: string): Promise<void> {
  const res = await fetch(`/api/mctb/exclusions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Could not remove exclusion");
}

/** Serialize handoff POSTs so config toggles cannot race recipient saves. */
let mctbHandoffWriteChain: Promise<void> = Promise.resolve();

export function postMctbHandoff(body: Record<string, unknown>): Promise<MctbHandoffPayload | null> {
  let savedPayload: MctbHandoffPayload | null = null;
  const run = async () => {
    const res = await fetch("/api/mctb/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((j as { error?: string }).error || "Handoff save failed");
    }
    savedPayload = parseMctbHandoffResponse(j);
  };
  mctbHandoffWriteChain = mctbHandoffWriteChain.catch(() => undefined).then(run);
  return mctbHandoffWriteChain.then(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mctb-handoff-updated"));
    }
    return savedPayload;
  });
}
