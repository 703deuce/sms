"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { GoogleMapsSearchResult } from "@/lib/voice-v3/business-import/google-types";
import type { ReviewCandidate } from "@/lib/voice-v3/business-import/types";

type Props = {
  state: AppointmentReceptionistWizardState;
  onStateChange: (patch: Partial<AppointmentReceptionistWizardState>) => void;
};

type SourceRecord = {
  websiteRootUrl?: string | null;
  googleDisplayName?: string | null;
  googleAddress?: string | null;
  lastCheckedAt?: string | null;
};

const PROGRESS_LABELS: Record<string, string> = {
  QUEUED: "Starting…",
  DISCOVERING: "Finding your business…",
  FETCHING: "Reading your website…",
  EXTRACTING: "Checking your services…",
  COMPARING: "Comparing business information…",
  REVIEW_READY: "Preparing your receptionist…",
  PARTIAL: "Some sources could not be read",
  FAILED: "Import could not finish",
};

function friendlyError(message: string): string {
  if (/not configured|SCRAPINGDOG/i.test(message)) {
    return "Business search is not available right now. You can still enter your website and set up manually.";
  }
  if (/403|blocked|HTTP 5/i.test(message)) {
    return "We couldn't read your website right now. You can retry, use Google, or continue manually.";
  }
  return message;
}

function formatLastChecked(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "Unknown";
  }
}

export function BusinessAutoSetupPanel({ state, onStateChange }: Props) {
  const agentId = state.agentId;
  const [website, setWebsite] = useState(state.websiteUrl || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GoogleMapsSearchResult[]>([]);
  const [selectedGoogle, setSelectedGoogle] = useState<GoogleMapsSearchResult | null>(null);
  const [sources, setSources] = useState<SourceRecord | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [importError, setImportError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [semanticSameIds, setSemanticSameIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setWebsite(state.websiteUrl || "");
  }, [state.websiteUrl]);

  const loadSources = useCallback(async () => {
    if (!agentId) return;
    const res = await fetch(`/api/voice-v3/business-import/sources?voiceAgentId=${encodeURIComponent(agentId)}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.data) {
      setSources(json.data as SourceRecord);
      if (json.data.websiteRootUrl && !website) setWebsite(json.data.websiteRootUrl);
    }
  }, [agentId, website]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const pollImport = useCallback(async (id: string) => {
    const res = await fetch(`/api/voice-v3/business-import/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || "Failed to load import");
    const data = json.data;
    setStatus(data.status);
    if (data.errorMessage) setImportError(friendlyError(String(data.errorMessage)));
    const review = data.review as { candidates?: ReviewCandidate[]; summary?: Record<string, unknown> } | undefined;
    if (review?.candidates) setCandidates(review.candidates);
    if (review?.summary) setSummary(review.summary);
    if (["REVIEW_READY", "PARTIAL", "FAILED", "APPLIED"].includes(data.status)) {
      void loadSources();
      return false;
    }
    return true;
  }, [loadSources]);

  useEffect(() => {
    if (!importId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const cont = await pollImport(importId);
        if (!cancelled && cont) setTimeout(tick, 2000);
      } catch (e) {
        if (!cancelled) setError(friendlyError(e instanceof Error ? e.message : "Import failed"));
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
      await loadSources();
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
      if ((json.data || []).length === 0) {
        setError("We couldn't find a match. Try your business name plus city, or continue with your website.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function startImport(
    trigger: "onboarding" | "refresh",
    sourceTypes?: string[],
  ) {
    if (!agentId) {
      setError("Save your agent draft first.");
      return;
    }
    if (!website && !selectedGoogle) {
      setError("Add a website or select your Google business listing.");
      return;
    }
    await saveSources();
    setBusy(true);
    setError("");
    setImportError("");
    try {
      const res = await fetch("/api/voice-v3/business-import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceAgentId: agentId, trigger, sourceTypes }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not start import");
      setImportId(json.data.importId);
      setStatus(json.data.status);
      setCandidates([]);
      setSummary(null);
    } finally {
      setBusy(false);
    }
  }

  const selectedForApply = useMemo(() => {
    return candidates.filter((c) => {
      if (c.classification === "SEMANTIC_DUPLICATE" && semanticSameIds.has(c.id)) return false;
      return c.selectedByDefault;
    });
  }, [candidates, semanticSameIds]);

  const applyCounts = useMemo(() => {
    let newCount = 0;
    let changedCount = 0;
    for (const c of selectedForApply) {
      if (c.classification === "NEW") newCount++;
      if (c.classification === "CHANGED" || c.classification === "CONFLICT") changedCount++;
    }
    return { newCount, changedCount, total: selectedForApply.length };
  }, [selectedForApply]);

  async function applySelected() {
    if (!importId) return;
    setBusy(true);
    setError("");
    try {
      const selectedCandidateIds = selectedForApply.map((c) => c.id);
      const res = await fetch(`/api/voice-v3/business-import/${importId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCandidateIds,
          treatSemanticDuplicateAsSame: [...semanticSameIds],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Apply failed");
      const next = json.data?.state as AppointmentReceptionistWizardState;
      if (next) onStateChange(next);
      setStatus("APPLIED");
      setShowApplyConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  function toggleCandidate(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selectedByDefault: !c.selectedByDefault } : c)),
    );
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ReviewCandidate[]>();
    for (const c of candidates) {
      const list = map.get(c.category) || [];
      list.push(c);
      map.set(c.category, list);
    }
    return [...map.entries()];
  }, [candidates]);

  const upToDate = summary && (summary as { upToDate?: boolean }).upToDate;
  const working = status && !["REVIEW_READY", "APPLIED", "FAILED", "PARTIAL"].includes(status);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold sm:text-base">Auto-setup from website &amp; Google</h3>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          You control what your receptionist knows. Nothing is added until you review it. Your
          existing information is never replaced automatically.
        </p>
      </div>

      {agentId && sources && (
        <div className="rounded-lg border border-border bg-card p-3 text-xs sm:text-sm">
          <p className="font-medium">Keep your receptionist up to date</p>
          <dl className="mt-2 space-y-1 text-muted-foreground">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-foreground">Website</dt>
              <dd className="break-all">{sources.websiteRootUrl || website || "Not set"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-foreground">Google</dt>
              <dd>
                {sources.googleDisplayName
                  ? `${sources.googleDisplayName}${sources.googleAddress ? ` — ${sources.googleAddress}` : ""}`
                  : selectedGoogle?.title || "Not linked"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 font-medium text-foreground">Last checked</dt>
              <dd>{formatLastChecked(sources.lastCheckedAt)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="biz-website">Website</Label>
        <Input
          id="biz-website"
          className="min-h-11"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
          autoComplete="url"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="biz-search">Find your business on Google</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="biz-search"
            className="min-h-11 flex-1"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Anthony's Plumbing, Woodbridge VA"
          />
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 shrink-0"
            disabled={busy}
            onClick={() => runSearch()}
          >
            Search
          </Button>
        </div>
        {searchResults.length > 0 && (
          <ul
            className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-2 text-sm"
            role="listbox"
            aria-label="Business search results"
          >
            {searchResults.map((r, i) => {
              const selected =
                selectedGoogle?.place_id === r.place_id && selectedGoogle?.data_id === r.data_id;
              return (
                <li key={`${r.place_id || r.data_id || i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="w-full min-h-11 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSelectedGoogle(r)}
                  >
                    <span className="font-medium">{r.title}</span>
                    {r.address && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{r.address}</span>
                    )}
                    {(r.phone || r.website) && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[r.phone, r.website].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {selected && <span className="mt-1 block text-xs font-medium text-primary">This is my business</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selectedGoogle?.website && !website && (
          <p className="text-xs text-muted-foreground sm:text-sm">
            We found your website: <span className="break-all font-medium">{selectedGoogle.website}</span>.
            It will be used when you run auto-setup.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" className="min-h-11" disabled={busy} onClick={() => startImport("onboarding")}>
          Run auto-setup
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={() => startImport("refresh")}
        >
          Check for updates
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-xs sm:text-sm"
          disabled={busy}
          onClick={() => startImport("refresh", ["website"])}
        >
          Website only
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-xs sm:text-sm"
          disabled={busy}
          onClick={() => startImport("refresh", ["google"])}
        >
          Google only
        </Button>
      </div>

      {working && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {PROGRESS_LABELS[status || ""] || "Working…"}
        </p>
      )}

      {importError && status === "PARTIAL" && (
        <p className="text-sm text-muted-foreground" role="status">
          We found some information, but a few pages could not be read. Review what we found or retry.
        </p>
      )}

      {upToDate && status === "REVIEW_READY" && (
        <p className="text-sm">You&apos;re up to date — we didn&apos;t find new business information.</p>
      )}

      {candidates.length > 0 && (status === "REVIEW_READY" || status === "PARTIAL") && !upToDate && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Review information</p>
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h4>
              <ul className="space-y-2 text-sm">
                {items.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border bg-card p-3">
                    {c.classification === "SEMANTIC_DUPLICATE" ? (
                      <div className="space-y-2">
                        <p className="font-medium">{c.label}</p>
                        {c.currentValue && (
                          <p className="text-xs text-muted-foreground">Existing: {c.currentValue}</p>
                        )}
                        <p className="text-xs">Found: {c.proposedValue}</p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="min-h-10"
                            onClick={() =>
                              setSemanticSameIds((prev) => new Set(prev).add(c.id))
                            }
                          >
                            Same service
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                            onClick={() => toggleCandidate(c.id)}
                          >
                            Add separately
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1.5 h-4 w-4 shrink-0"
                          checked={c.selectedByDefault}
                          onChange={() => toggleCandidate(c.id)}
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{c.label}</span>
                          {c.currentValue && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Current: {c.currentValue}
                            </span>
                          )}
                          <span className="mt-1 block break-words text-xs">Found: {c.proposedValue}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {c.provenance.sourceType === "GOOGLE_MAPS"
                              ? "Found on Google"
                              : "Found on your website"}
                          </span>
                        </span>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!showApplyConfirm ? (
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={busy || selectedForApply.length === 0}
              onClick={() => setShowApplyConfirm(true)}
            >
              Review apply ({selectedForApply.length} selected)
            </Button>
          ) : (
            <div className="rounded-lg border border-primary/30 bg-card p-3 space-y-3">
              <p className="text-sm">
                Add {applyCounts.newCount} new detail{applyCounts.newCount === 1 ? "" : "s"}
                {applyCounts.changedCount > 0
                  ? ` and update ${applyCounts.changedCount} existing detail${applyCounts.changedCount === 1 ? "" : "s"}`
                  : ""}
                ?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" className="min-h-11" disabled={busy} onClick={() => applySelected()}>
                  Apply selected information
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => setShowApplyConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
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
