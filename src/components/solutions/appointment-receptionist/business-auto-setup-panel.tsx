"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { GoogleMapsSearchResult } from "@/lib/scrapingdog/client";
import type { ReviewCandidate } from "@/lib/voice-v3/business-import/types";

type Props = {
  state: AppointmentReceptionistWizardState;
  onStateChange: (patch: Partial<AppointmentReceptionistWizardState>) => void;
};

const PROGRESS_LABELS: Record<string, string> = {
  QUEUED: "Starting…",
  DISCOVERING: "Finding your business…",
  FETCHING: "Reading your website…",
  EXTRACTING: "Checking your services…",
  COMPARING: "Comparing business information…",
  REVIEW_READY: "Ready for review",
};

export function BusinessAutoSetupPanel({ state, onStateChange }: Props) {
  const agentId = state.agentId;
  const [website, setWebsite] = useState(state.websiteUrl || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GoogleMapsSearchResult[]>([]);
  const [selectedGoogle, setSelectedGoogle] = useState<GoogleMapsSearchResult | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setWebsite(state.websiteUrl || "");
  }, [state.websiteUrl]);

  const pollImport = useCallback(async (id: string) => {
    const res = await fetch(`/api/voice-v3/business-import/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Failed to load import");
    const data = json.data;
    setStatus(data.status);
    const review = data.review as { candidates?: ReviewCandidate[]; summary?: Record<string, unknown> } | undefined;
    if (review?.candidates) setCandidates(review.candidates);
    if (review?.summary) setSummary(review.summary);
    if (data.status === "REVIEW_READY" || data.status === "PARTIAL" || data.status === "FAILED") {
      return false;
    }
    return true;
  }, []);

  useEffect(() => {
    if (!importId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const cont = await pollImport(importId);
        if (!cancelled && cont) setTimeout(tick, 2000);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Import failed");
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [importId, pollImport]);

  async function saveSources() {
    if (!agentId) {
      setError("Save your agent draft first so we can attach sources.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/voice-v3/business-import/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceAgentId: agentId,
          websiteUrl: website || null,
          googleSelection: selectedGoogle,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not save sources");
      if (website) onStateChange({ websiteUrl: website });
      const discovered = selectedGoogle?.website;
      if (discovered && !website) {
        setWebsite(discovered);
        onStateChange({ websiteUrl: discovered });
      }
    } finally {
      setBusy(false);
    }
  }

  async function runSearch() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/voice-v3/business-import/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Search failed");
      setSearchResults(json.data || []);
    } finally {
      setBusy(false);
    }
  }

  async function startImport(trigger: "onboarding" | "refresh") {
    if (!agentId) {
      setError("Save your agent draft first.");
      return;
    }
    await saveSources();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/voice-v3/business-import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceAgentId: agentId, trigger }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not start import");
      setImportId(json.data.importId);
      setStatus(json.data.status);
      setCandidates([]);
    } finally {
      setBusy(false);
    }
  }

  async function applySelected() {
    if (!importId) return;
    setBusy(true);
    setError("");
    try {
      const selectedCandidateIds = candidates
        .filter((c) => c.selectedByDefault)
        .map((c) => c.id);
      const res = await fetch(`/api/voice-v3/business-import/${importId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCandidateIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Apply failed");
      const next = json.data?.state as AppointmentReceptionistWizardState;
      if (next) onStateChange(next);
      setStatus("APPLIED");
    } finally {
      setBusy(false);
    }
  }

  function toggleCandidate(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selectedByDefault: !c.selectedByDefault } : c)),
    );
  }

  const upToDate = summary && (summary as { upToDate?: boolean }).upToDate;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div>
        <h3 className="text-sm font-semibold">Auto-setup from website &amp; Google</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Nothing is added until you review it. Your existing information is never replaced automatically.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="biz-website">Website</Label>
        <Input
          id="biz-website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="biz-search">Find your business on Google</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="biz-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Business name and city"
          />
          <Button type="button" variant="secondary" disabled={busy} onClick={() => runSearch()}>
            Search
          </Button>
        </div>
        {searchResults.length > 0 && (
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-2 text-sm">
            {searchResults.map((r, i) => (
              <li key={`${r.place_id || r.data_id || i}`}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted"
                  onClick={() => setSelectedGoogle(r)}
                >
                  <span className="font-medium">{r.title}</span>
                  {r.address && <span className="block text-xs text-muted-foreground">{r.address}</span>}
                  {selectedGoogle === r && (
                    <span className="text-xs text-primary">Selected</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedGoogle?.website && !website && (
          <p className="text-xs text-muted-foreground">
            We found your website: {selectedGoogle.website}. It will be used when you run auto-setup.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => startImport("onboarding")}>
          Run auto-setup
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => startImport("refresh")}>
          Check for updates
        </Button>
      </div>

      {status && status !== "REVIEW_READY" && status !== "APPLIED" && (
        <p className="text-sm text-muted-foreground" role="status">
          {PROGRESS_LABELS[status] || "Working…"}
        </p>
      )}

      {upToDate && status === "REVIEW_READY" && (
        <p className="text-sm">You&apos;re up to date — we didn&apos;t find new business information.</p>
      )}

      {candidates.length > 0 && status === "REVIEW_READY" && !upToDate && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Review information</p>
          <ul className="space-y-2 text-sm">
            {candidates.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={c.selectedByDefault}
                    onChange={() => toggleCandidate(c.id)}
                  />
                  <span>
                    <span className="font-medium">{c.label}</span>
                    {c.currentValue && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Current: {c.currentValue}
                      </span>
                    )}
                    <span className="mt-1 block text-xs">Found: {c.proposedValue}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {c.provenance.sourceType === "GOOGLE_MAPS" ? "Found on Google" : "Found on your website"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button type="button" disabled={busy} onClick={() => applySelected()}>
            Apply selected information
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
