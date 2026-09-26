export async function fetchMctbSetup(): Promise<Record<string, unknown>> {
  const res = await fetch("/api/mctb/setup", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load MCTB setup");
  const json = (await res.json()) as { data?: Record<string, unknown> };
  return (json.data ?? json) as Record<string, unknown>;
}

export async function saveMctbSetup(patch: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/mctb/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || "Save failed");
  }
}

export async function fetchMctbExclusions(): Promise<unknown[]> {
  const res = await fetch("/api/mctb/exclusions", { cache: "no-store" });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.data ?? j.exclusions ?? []) as unknown[];
}

export async function addMctbExclusion(input: { phoneE164: string; label?: string }): Promise<void> {
  const res = await fetch("/api/mctb/exclusions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Could not add exclusion");
}

export async function deleteMctbExclusion(id: string): Promise<void> {
  const res = await fetch(`/api/mctb/exclusions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Could not remove exclusion");
}
