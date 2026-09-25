"use client";

import { BusinessScheduleEditor } from "@/components/solutions/appointment-receptionist/operating-maturity-editor";
import { InfoCallout } from "@/components/solutions/appointment-receptionist/ui";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import {
  businessScheduleHasHours,
  formatBusinessHoursSummaryLine,
  mirrorTimezoneFromBusinessSchedule,
  syncHoursKnowledgeItemFromSchedule,
} from "@/lib/solutions/appointment-receptionist/knowledge-editor-schedule";
import {
  ensureReceptionistAgentId,
  persistKnowledgeWizardStep,
} from "@/lib/solutions/appointment-receptionist/knowledge-editor-persist";
import {
  normalizeWebsiteUrl,
  upsertKnowledgeItem,
} from "@/lib/solutions/appointment-receptionist/knowledge-items-helpers";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { compileBusinessHoursAmyDisplay } from "@/lib/voice-v3/config/business-hours-display";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { customerSourceStatusLabel, isSourceSearchReady } from "@/lib/voice/knowledge/source-status-label";
import {
  mapCrawlJobToCustomerView,
  suggestionRows,
  type CrawlJobCustomerView,
} from "@/lib/voice/knowledge/website-crawl-customer-status";
import { KnowledgeGapsPanel } from "@/components/voice/knowledge-gaps-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { toErrorMessage } from "@/lib/errors";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Trash2, Upload } from "lucide-react";

type KbSource = {
  id: string;
  name: string;
  sourceType: string;
  status: string;
  updatedAt?: string;
};

type CrawlJob = {
  id: string;
  status: string;
  errorSummary?: string | null;
  suggestions?: unknown;
  stats?: { pagesIndexed?: number } | null;
};

function baseState(): AppointmentReceptionistWizardState {
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return { ...base, solutionName: "AI Receptionist", role: "Front-desk receptionist" };
}

function itemSummary(state: AppointmentReceptionistWizardState, id: string): string {
  return state.knowledgeItems.find((k) => k.id === id)?.summary?.trim() || "";
}

export function BusinessKnowledgeEditor() {
  const [state, setState] = useState(baseState);
  const [baseline, setBaseline] = useState(baseState);
  const [agentStatus, setAgentStatus] = useState("DRAFT");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [sources, setSources] = useState<KbSource[]>([]);
  const [crawlJob, setCrawlJob] = useState<CrawlJob | null>(null);
  const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
  const [showHoursProse, setShowHoursProse] = useState(false);
  const [gapRefresh, setGapRefresh] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
    setInfoMessage("");
  }, []);

  const linkedKbId = state.linkedKnowledgeBaseId || "";

  const loadSources = useCallback(async (kbId: string) => {
    if (!kbId) {
      setSources([]);
      return;
    }
    const res = await fetch(`/api/voice/knowledge/${kbId}`);
    const json = await res.json();
    const list = (json.data?.sources || []) as KbSource[];
    setSources(list);
  }, []);

  const loadCrawl = useCallback(async (kbId: string) => {
    if (!kbId) {
      setCrawlJob(null);
      return;
    }
    const res = await fetch(
      `/api/voice/knowledge/crawl/latest?knowledgeBaseId=${encodeURIComponent(kbId)}`,
    );
    const json = await res.json();
    setCrawlJob(json.data || null);
    if (json.data?.id) setCrawlJobId(json.data.id);
  }, []);

  const loadSetup = useCallback(async () => {
    setError("");
    try {
      let agentId: string | null = null;
      const agentsRes = await fetch("/api/voice/agents");
      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json();
        agentId = ((agentsJson.data || []) as Array<{ id: string }>)[0]?.id ?? null;
      }
      const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
      const res = await fetch(`/api/solutions/appointment-receptionist${qs}`);
      if (!res.ok) throw new Error("Could not load business knowledge");
      const json = await res.json();
      const loaded = json?.data;
      if (loaded?.state) {
        const merged = {
          ...baseState(),
          ...loaded.state,
          agentId: loaded.agentId || loaded.state.agentId,
        } as AppointmentReceptionistWizardState;
        setState(merged);
        setBaseline(merged);
        setAgentStatus(loaded.status || "DRAFT");
      }
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    if (linkedKbId) {
      void loadSources(linkedKbId);
      void loadCrawl(linkedKbId);
    }
  }, [linkedKbId, loadSources, loadCrawl]);

  const dismissedKeys = useMemo(() => {
    const s = crawlJob?.suggestions as { _dismissed?: string[] } | undefined;
    return s?._dismissed || [];
  }, [crawlJob]);

  const crawlView: CrawlJobCustomerView = useMemo(
    () =>
      mapCrawlJobToCustomerView({
        websiteUrl: state.websiteUrl,
        job: crawlJob,
        dismissedKeys,
      }),
    [state.websiteUrl, crawlJob, dismissedKeys],
  );

  const suggestions = useMemo(
    () => suggestionRows((crawlJob?.suggestions || {}) as Record<string, unknown>, dismissedKeys),
    [crawlJob, dismissedKeys],
  );

  const failedSources = sources.filter((s) => s.status === "failed").length;
  const hoursDisplay = useMemo(() => {
    const m = ensureWizardOperatingMaturity(state);
    return compileBusinessHoursAmyDisplay({
      structuredSchedule: m.businessSchedule,
      hoursKnowledgeProse: itemSummary(state, "hours"),
    });
  }, [state]);

  const statusItems = useMemo(() => {
    const items: Array<{ label: string; href: string }> = [];
    if (!state.businessName?.trim()) {
      items.push({ label: "Add your business name", href: "#core-facts" });
    }
    if (!businessScheduleHasHours(state)) {
      items.push({ label: "Set business hours", href: "#hours" });
    }
    if (crawlView.reviewCount > 0) {
      items.push({
        label: `${crawlView.reviewCount} detail(s) from your website need review`,
        href: "#website",
      });
    }
    if (failedSources > 0) {
      items.push({
        label: `${failedSources} source(s) need attention`,
        href: "#sources",
      });
    }
    if (crawlView.phase === "discovering" || crawlView.phase === "reading" || crawlView.phase === "preparing") {
      items.push({ label: "Website is still being prepared", href: "#website" });
    }
    return items;
  }, [state.businessName, crawlView, failedSources]);

  const needsPublishBanner =
    agentStatus === "ACTIVE" &&
    JSON.stringify(state.knowledgeItems) !== JSON.stringify(baseline.knowledgeItems);

  useEffect(() => {
    if (!crawlJobId) return;
    const active = ["DISCOVERING", "CRAWLING"].includes(crawlJob?.status || "");
    if (!active) return;
    const t = setInterval(() => {
      void loadCrawl(linkedKbId);
    }, 4000);
    return () => clearInterval(t);
  }, [crawlJobId, crawlJob?.status, linkedKbId, loadCrawl]);

  async function saveInformation(next?: AppointmentReceptionistWizardState) {
    setBusy(true);
    setError("");
    let working = next || state;
    const ensured = await ensureReceptionistAgentId(working);
    if (!ensured.ok) {
      setError(ensured.error || "Could not save");
      setBusy(false);
      return;
    }
    working = ensured.state;
    const result = await persistKnowledgeWizardStep({
      state: working,
      wizardStepId: "information",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Save failed");
      return;
    }
    const merged = { ...working, agentId: result.agentId || working.agentId };
    setState(merged);
    setBaseline(merged);
    setInfoMessage("Saved. Publish from Receptionist for live caller instructions.");
  }

  async function saveSchedule() {
    setBusy(true);
    setError("");
    let working = mirrorTimezoneFromBusinessSchedule(state);
    working = syncHoursKnowledgeItemFromSchedule(working);
    const ensured = await ensureReceptionistAgentId(working);
    if (!ensured.ok) {
      setError(ensured.error || "Could not save");
      setBusy(false);
      return;
    }
    working = ensured.state;
    const result = await persistKnowledgeWizardStep({
      state: working,
      wizardStepId: "call-handling",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Save failed");
      return;
    }
    const merged = { ...working, agentId: result.agentId || working.agentId };
    setState(merged);
    setBaseline(merged);
    setInfoMessage(
      "Business hours saved. Publish from Receptionist for live after-hours behavior.",
    );
  }

  async function ensureKb(): Promise<string | null> {
    if (linkedKbId) return linkedKbId;
    const res = await fetch("/api/voice/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `${state.businessName || "Business"} knowledge`,
      }),
    });
    const json = await res.json();
    const id = json.data?.id as string | undefined;
    if (!id) return null;
    patch({ linkedKnowledgeBaseId: id });
    return id;
  }

  async function scanWebsite() {
    const url = normalizeWebsiteUrl(state.websiteUrl);
    if (!url) return;
    setBusy(true);
    setError("");
    try {
      const kbId = (await ensureKb()) || linkedKbId;
      const res = await fetch("/api/voice/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "scan_website",
          url,
          knowledgeBaseId: kbId,
          name: `${state.businessName || "Business"} website`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setCrawlJobId(json.data?.crawlJobId || null);
      await saveInformation({ ...state, websiteUrl: url, linkedKnowledgeBaseId: kbId || linkedKbId });
      if (kbId) await loadCrawl(kbId);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function approveSuggestion(key: string, value: string, editValue?: string) {
    const val = (editValue ?? value).trim();
    let items = [...state.knowledgeItems];
    if (key === "businessName") {
      patch({ businessName: val });
      items = upsertKnowledgeItem(items, "business", {
        label: "Business details",
        summary: val,
        status: "complete",
        statusLabel: "Approved",
      });
    } else if (key === "services") {
      items = upsertKnowledgeItem(items, "services", {
        label: "Services",
        summary: val,
        status: "complete",
        statusLabel: "Approved",
      });
    } else if (key === "serviceArea") {
      items = upsertKnowledgeItem(items, "service_area", {
        label: "Service area",
        summary: val,
        status: "complete",
        statusLabel: "Approved",
      });
    } else if (key === "hoursText") {
      items = upsertKnowledgeItem(items, "hours", {
        label: "Hours",
        summary: val,
        status: "complete",
        statusLabel: "Approved",
      });
    } else if (key === "description") {
      items = upsertKnowledgeItem(items, "business", {
        label: "Business details",
        summary: val,
        status: "complete",
        statusLabel: "Approved",
      });
    }
    await saveInformation({ ...state, businessName: key === "businessName" ? val : state.businessName, knowledgeItems: items });
  }

  async function dismissSuggestion(key: string) {
    if (!crawlJob?.id) return;
    await fetch(`/api/voice/knowledge/crawl/${crawlJob.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissKey: key }),
    });
    await loadCrawl(linkedKbId);
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <PageHeader title="Business Knowledge" description="Loading…" />
        <VoiceSubNav />
        <p className="text-sm text-muted-foreground">Loading business knowledge…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <PageHeader
        title="Business Knowledge"
        description="Teach Amy accurate information about your business, manage sources she can search, and resolve questions she could not answer on calls."
        actions={
          <Link href="/company-brain" className="text-sm text-muted-foreground hover:text-primary">
            Company-wide knowledge
          </Link>
        }
      />
      <VoiceSubNav />

      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {infoMessage ? (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm" role="status">
          {infoMessage}
        </div>
      ) : null}

      <div className="space-y-8">
        {statusItems.length > 0 ? (
          <Card className="p-5" id="status">
            <h2 className="text-sm font-semibold">Needs your review</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {statusItems.map((item) => (
                <li key={item.href + item.label}>
                  <a href={item.href} className="text-primary underline">{item.label}</a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {needsPublishBanner ? (
          <InfoCallout>
            <p>
              <span className="font-medium">Publish required.</span> Changes to core business
              information are saved as a draft.{" "}
              <Link href="/voice/receptionist" className="font-medium text-primary underline">
                Review &amp; publish
              </Link>{" "}
              to make them part of Amy&apos;s live instructions.
            </p>
          </InfoCallout>
        ) : null}

        <Card className="space-y-4 p-5" id="core-facts">
          <h2 className="text-lg font-semibold">Core business information</h2>
          <FactField
            label="Business name"
            value={state.businessName || ""}
            onChange={(v) => patch({ businessName: v })}
          />
          <FactField
            label="Business description & location"
            value={itemSummary(state, "business")}
            onChange={(v) =>
              patch({
                knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "business", {
                  label: "Business details",
                  summary: v,
                  status: "complete",
                  statusLabel: "Saved",
                }),
              })
            }
            multiline
          />
          <FactField
            label="Services"
            value={itemSummary(state, "services")}
            onChange={(v) =>
              patch({
                knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "services", {
                  label: "Services",
                  summary: v,
                  status: "complete",
                  statusLabel: "Saved",
                }),
              })
            }
            multiline
          />
          <FactField
            label="Service area"
            value={itemSummary(state, "service_area")}
            onChange={(v) =>
              patch({
                knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "service_area", {
                  label: "Service area",
                  summary: v,
                  status: "complete",
                  statusLabel: "Saved",
                }),
              })
            }
          />
          <FactField
            label="Pricing"
            value={itemSummary(state, "pricing")}
            onChange={(v) =>
              patch({
                knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "pricing", {
                  label: "Pricing",
                  summary: v,
                  status: "complete",
                  statusLabel: "Saved",
                }),
              })
            }
            multiline
          />
          <FactField
            label="Policies"
            value={itemSummary(state, "policies")}
            onChange={(v) =>
              patch({
                knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "policies", {
                  label: "Policies",
                  summary: v,
                  status: "complete",
                  statusLabel: "Saved",
                }),
              })
            }
            multiline
          />
          <Button type="button" disabled={busy} onClick={() => void saveInformation()}>
            {busy ? "Saving…" : "Save business information"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5" id="hours">
          <h2 className="text-lg font-semibold">Business hours &amp; timezone</h2>
          <p className="text-sm text-muted-foreground">
            How Amy describes your hours:{" "}
            <span className="text-foreground">
              {hoursDisplay.hoursDisplay || "Set weekly hours below"}
            </span>
          </p>
          {hoursDisplay.hoursProseConflictsWithStructured ? (
            <p className="text-xs text-warning">
              Custom hours wording differs from your schedule. Callers hear the schedule above unless you customize wording.
            </p>
          ) : null}
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => setShowHoursProse((v) => !v)}
          >
            {showHoursProse ? "Hide" : "Customize how Amy describes these hours"}
          </button>
          {showHoursProse ? (
            <Textarea
              rows={3}
              value={itemSummary(state, "hours")}
              onChange={(e) =>
                patch({
                  knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "hours", {
                    label: "Hours",
                    summary: e.target.value,
                    status: "complete",
                    statusLabel: "Custom wording",
                  }),
                })
              }
            />
          ) : null}
          <BusinessScheduleEditor state={state} patch={patch} />
          <p className="text-sm text-muted-foreground">
            Summary: {formatBusinessHoursSummaryLine(state)}
          </p>
          <Button type="button" disabled={busy} onClick={() => void saveSchedule()}>
            {busy ? "Saving…" : "Save business hours"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5" id="website">
          <h2 className="text-lg font-semibold">Website</h2>
          <div>
            <Label htmlFor="website-url">Website URL</Label>
            <Input
              id="website-url"
              className="mt-1"
              value={state.websiteUrl || ""}
              onChange={(e) => patch({ websiteUrl: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void saveInformation()}>
              Save website
            </Button>
            <Button type="button" disabled={busy} onClick={() => void scanWebsite()}>
              Scan website
            </Button>
          </div>
          <div className="rounded-lg border border-border p-3 text-sm" aria-live="polite">
            <p className="font-medium">{crawlView.headline}</p>
            {crawlView.detail ? (
              <p className="mt-1 text-muted-foreground">{crawlView.detail}</p>
            ) : null}
            {crawlView.searchable ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Amy can search this website when callers ask questions. This is separate from approving details as core business information.
              </p>
            ) : null}
          </div>
          {suggestions.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Review website details</h3>
              {suggestions.map((row) => (
                <div key={row.key} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{row.label}</p>
                  <p className="mt-1 text-muted-foreground">{row.value}</p>
                  <p className="text-xs text-muted-foreground">From your website</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy || row.sensitive}
                      onClick={() => void approveSuggestion(row.key, row.value)}
                    >
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void dismissSuggestion(row.key)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="space-y-4 p-5" id="faqs">
          <h2 className="text-lg font-semibold">FAQs &amp; approved answers</h2>
          <FactField
            label="Common questions & answers"
            value={itemSummary(state, "faqs")}
            onChange={(v) =>
              patch({
                knowledgeItems: upsertKnowledgeItem(state.knowledgeItems, "faqs", {
                  label: "FAQs",
                  summary: v,
                  status: "complete",
                  statusLabel: "Saved",
                }),
              })
            }
            multiline
          />
          <p className="text-xs text-muted-foreground">
            Answers you add from unanswered caller questions appear as searchable sources below once processed.
          </p>
          <Button type="button" disabled={busy} onClick={() => void saveInformation()}>
            Save FAQs
          </Button>
        </Card>

        <Card className="space-y-4 p-5" id="sources">
          <h2 className="text-lg font-semibold">Knowledge sources</h2>
          <p className="text-sm text-muted-foreground">
            Documents and pages Amy can search during calls. Ready for search means retrieval is available — not the same as published instructions.
          </p>
          <SourceManager
            kbId={linkedKbId}
            sources={sources}
            busy={busy}
            fileInputRef={fileInputRef}
            onEnsureKb={ensureKb}
            onReload={() => void loadSources(linkedKbId)}
            setBusy={setBusy}
            setError={setError}
          />
        </Card>

        <div id="knowledge-gaps" key={gapRefresh}>
          <KnowledgeGapsPanel
            defaultKnowledgeBaseId={linkedKbId}
            onResolved={() => setGapRefresh((n) => n + 1)}
          />
        </div>
      </div>
    </div>
  );
}

function FactField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <Label className="text-sm font-medium">{label}</Label>
      {multiline ? (
        <Textarea className="mt-1" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function SourceManager({
  kbId,
  sources,
  busy,
  fileInputRef,
  onEnsureKb,
  onReload,
  setBusy,
  setError,
}: {
  kbId: string;
  sources: KbSource[];
  busy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onEnsureKb: () => Promise<string | null>;
  onReload: () => void;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  async function withKb(run: (id: string) => Promise<void>) {
    setBusy(true);
    try {
      const id = (await onEnsureKb()) || kbId;
      if (!id) throw new Error("Could not create knowledge base");
      await run(id);
      onReload();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Add text</Label>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !text.trim()}
          onClick={() =>
            void withKb(async (id) => {
              await fetch(`/api/voice/knowledge/${id}/sources`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: "Text", sourceType: "text", contentText: text }),
              });
              setText("");
            })
          }
        >
          Add text source
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-md"
          placeholder="https://example.com/page"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !url.trim()}
          onClick={() =>
            void withKb(async (id) => {
              await fetch(`/api/voice/knowledge/${id}/sources`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: url, sourceType: "url", crawlUrl: url }),
              });
              setUrl("");
            })
          }
        >
          Add URL
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.csv,.md"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void withKb(async (id) => {
              const form = new FormData();
              form.append("file", file);
              const res = await fetch(`/api/voice/knowledge/${id}/upload`, { method: "POST", body: form });
              if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Upload failed");
              }
            });
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-1 h-3 w-3" /> Upload file
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH className="hidden sm:table-cell">Type</TH>
              <TH>Status</TH>
              <TH className="hidden md:table-cell">Updated</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {sources.length === 0 ? (
              <TR>
                <TD colSpan={5} className="text-muted-foreground">No sources yet.</TD>
              </TR>
            ) : (
              sources.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <span className="font-medium">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                      {s.sourceType}
                    </span>
                  </TD>
                  <TD className="hidden sm:table-cell">{s.sourceType}</TD>
                  <TD>{customerSourceStatusLabel(s.status)}</TD>
                  <TD className="hidden md:table-cell text-muted-foreground text-xs">
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "—"}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {!isSourceSearchReady(s.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void withKb(async (id) => {
                              await fetch(`/api/voice/knowledge/${id}/sources/${s.id}`, {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ action: "reindex" }),
                              });
                            })
                          }
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!confirm("Remove this source?")) return;
                          void withKb(async (id) => {
                            await fetch(`/api/voice/knowledge/${id}/sources/${s.id}`, {
                              method: "DELETE",
                            });
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
