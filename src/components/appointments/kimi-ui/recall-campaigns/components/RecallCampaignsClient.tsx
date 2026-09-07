"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { mockCampaigns, type RecallCampaign } from "../types";
import { CampaignList } from "./CampaignList";
import { CampaignEditor } from "./CampaignEditor";
import { RunResultDialog } from "./RunResultDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";

type LoadState = "loading" | "ready" | "empty" | "error";

export function RecallCampaignsClient() {
  const [campaigns, setCampaigns] = useState<RecallCampaign[]>([]);
  const [selected, setSelected] = useState<RecallCampaign | null>(null);
  const [acting, setActing] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [degraded, setDegraded] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [runResult, setRunResult] = useState<{ sent: number; targeted: number; name: string } | null>(null);
  const [runConfirm, setRunConfirm] = useState<RecallCampaign | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RecallCampaign | null>(null);
  const [pendingSelect, setPendingSelect] = useState<RecallCampaign | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback((simulate: LoadState = "ready", opts?: { degraded?: boolean; readOnly?: boolean }) => {
    setLoadState("loading");
    setDegraded(false);
    // Simulated fetch of GET /api/appointments/recall-campaigns
    window.setTimeout(() => {
      if (simulate === "error") {
        setLoadState("error");
        return;
      }
      if (simulate === "empty") {
        setCampaigns([]);
        setSelected(null);
        setLoadState("empty");
        return;
      }
      setCampaigns(mockCampaigns);
      setSelected((prev) => {
        if (prev) {
          const fresh = mockCampaigns.find((c) => c.id === prev.id);
          return fresh ?? mockCampaigns[0] ?? null;
        }
        return mockCampaigns[0] ?? null;
      });
      setDegraded(Boolean(opts?.degraded));
      setReadOnly(Boolean(opts?.readOnly));
      setLoadState("ready");
    }, 450);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!selected) return;
    setActing(true);
    // POST /api/appointments/recall-campaigns { campaign: selected }
    await new Promise((r) => setTimeout(r, 600));
    setCampaigns((prev) => prev.map((c) => (c.id === selected.id ? selected : c)));
    setActing(false);
    setDirty(false);
    setNotice({ kind: "success", text: "Campaign saved." });
  }

  async function runConfirmed() {
    const campaign = runConfirm;
    if (!campaign) return;
    setActing(true);
    setNotice(null);
    // POST /api/appointments/recall-campaigns { action: "run", campaignId: campaign.id }
    await new Promise((r) => setTimeout(r, 900));
    const targeted = Math.min(campaign.maxRecipients ?? 400, 418);
    const sent = Math.round(targeted * 0.94);
    setActing(false);
    setRunConfirm(null);
    setRunResult({ sent, targeted, name: campaign.name });
    const now = new Date().toISOString();
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaign.id ? { ...c, lastRunAt: now, lastRunSent: sent } : c)),
    );
    setSelected((prev) => (prev && prev.id === campaign.id ? { ...prev, lastRunAt: now, lastRunSent: sent } : prev));
  }

  async function deleteConfirmed() {
    const campaign = deleteConfirm;
    if (!campaign) return;
    setActing(true);
    // DELETE /api/appointments/recall-campaigns { campaignId: campaign.id }
    await new Promise((r) => setTimeout(r, 500));
    setActing(false);
    setDeleteConfirm(null);
    setCampaigns((prev) => {
      const next = prev.filter((c) => c.id !== campaign.id);
      setSelected((sel) => (sel?.id === campaign.id ? next[0] ?? null : sel));
      if (next.length === 0) setLoadState("empty");
      return next;
    });
    setDirty(false);
    setNotice({ kind: "success", text: `“${campaign.name}” was deleted.` });
  }

  async function create() {
    setActing(true);
    // POST /api/appointments/recall-campaigns (create)
    await new Promise((r) => setTimeout(r, 500));
    const draft: RecallCampaign = {
      id: `rc_${Date.now()}`,
      name: "Untitled campaign",
      active: false,
      channel: "sms",
      messageTemplate:
        "Hi {{first_name}}, it's been a while since your last visit to {{business_name}}. Book your next appointment: {{booking_link}}",
      segment: { lastVisitDaysAgo: 90, noFutureAppointment: true },
      createdAt: new Date().toISOString(),
    };
    setCampaigns((prev) => [draft, ...prev]);
    setSelected(draft);
    setDirty(true);
    setLoadState("ready");
    setActing(false);
    setNotice(null);
  }

  const updateSelected = useCallback((next: RecallCampaign) => {
    setSelected(next);
    setDirty(true);
  }, []);

  const requestSelect = useCallback(
    (c: RecallCampaign) => {
      if (dirty && !readOnly && c.id !== selected?.id) {
        setPendingSelect(c);
      } else {
        setSelected(c);
        setDirty(false);
      }
    },
    [dirty, readOnly, selected?.id],
  );

  const stats = useMemo(() => {
    const active = campaigns.filter((c) => c.active).length;
    const totalSent = campaigns.reduce((n, c) => n + (c.lastRunSent ?? 0), 0);
    return { active, totalSent, total: campaigns.length };
  }, [campaigns]);

  return (
    <div className="rc-shell">
      {/* Simulated app top bar (shell is provided by layout in production) */}
      <header className="rc-topbar">
        <div className="rc-logo">
          <span className="rc-logo-mark">T</span>
          <span>Transovo</span>
        </div>
        <nav className="rc-breadcrumb" aria-label="Breadcrumb">
          <span>Appointments</span>
          <span aria-hidden="true">/</span>
          <span>Recalls</span>
          <span aria-hidden="true">/</span>
          <strong>Recall campaigns</strong>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Recall campaigns
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Re-engage customers who haven&apos;t visited in a while. Target contacts by
              last visit or appointment type and reach them by SMS or email.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={create}
              disabled={acting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[hsl(var(--primary-hover))] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New campaign
            </button>
          )}
        </div>

        {/* Stat strip */}
        {loadState === "ready" && campaigns.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Campaigns", value: String(stats.total) },
              { label: "Active", value: String(stats.active) },
              { label: "Messages sent (all runs)", value: stats.totalSent.toLocaleString("en-US") },
            ].map((s) => (
              <div key={s.label} className="surface rounded-xl bg-card px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 font-display text-xl font-semibold tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Degraded / partial state */}
        {degraded && loadState === "ready" && (
          <div className="rc-banner rc-banner-warning mt-4" role="status">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Consent status for some contacts is temporarily unavailable. Campaigns can
              still be edited, but audience counts may be incomplete until sync resumes.
            </span>
            <button
              type="button"
              onClick={() => load("ready")}
              className="ml-auto shrink-0 text-[13px] font-semibold text-[hsl(var(--primary))] hover:underline"
            >
              Retry sync
            </button>
          </div>
        )}

        {/* Notices */}
        {notice && (
          <div className={`rc-banner mt-4 ${notice.kind === "success" ? "rc-banner-success" : "rc-banner-error"}`} role="status">
            <span>{notice.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="mt-5">
          {loadState === "loading" && <LoadingSkeleton />}

          {loadState === "error" && (
            <div className="surface rounded-xl bg-card p-10 text-center">
              <TriangleAlert className="mx-auto h-8 w-8 text-[hsl(var(--warning))]" aria-hidden="true" />
              <h2 className="mt-3 font-display text-base font-semibold">
                Recall campaigns couldn&apos;t be loaded
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Something went wrong while fetching your campaigns. Your saved campaigns
                were not affected.
              </p>
              <button
                type="button"
                onClick={() => load("ready")}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold shadow-sm hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          {loadState === "empty" && <EmptyState onCreate={create} acting={acting} />}

          {loadState === "ready" && campaigns.length > 0 && (
            <div className="grid items-start gap-4 lg:grid-cols-3">
              <CampaignList
                campaigns={campaigns}
                selectedId={selected?.id ?? null}
                onSelect={requestSelect}
              />
              {selected ? (
                <CampaignEditor
                  key={selected.id}
                  campaign={selected}
                  acting={acting}
                  dirty={dirty}
                  readOnly={readOnly}
                  onChange={updateSelected}
                  onSave={save}
                  onRun={() => setRunConfirm(selected)}
                  onDelete={() => setDeleteConfirm(selected)}
                />
              ) : (
                <div className="surface rounded-xl bg-card p-10 text-center lg:col-span-2">
                  <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Select a campaign to edit its settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Run confirmation */}
      {runConfirm && (
        <ConfirmDialog
          title={`Run “${runConfirm.name}” now?`}
          body={
            <>
              This will message every contact matching the current audience
              {runConfirm.maxRecipients
                ? `, up to ${runConfirm.maxRecipients.toLocaleString("en-US")} recipients`
                : ""}
              . Contacts without valid {runConfirm.channel === "sms" ? "SMS " : ""}consent or
              with an upcoming appointment are skipped automatically.
            </>
          }
          confirmLabel="Run campaign"
          busy={acting}
          onConfirm={runConfirmed}
          onClose={() => setRunConfirm(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <ConfirmDialog
          title={`Delete “${deleteConfirm.name}”?`}
          body={
            <>
              This permanently removes the campaign&apos;s settings and run history.
              Contacts who already received messages are not affected. This can&apos;t be
              undone.
            </>
          }
          confirmLabel="Delete campaign"
          destructive
          busy={acting}
          onConfirm={deleteConfirmed}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {/* Unsaved changes guard */}
      {pendingSelect && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          body={
            <>
              Your changes to <span className="font-semibold text-foreground">{selected?.name}</span>{" "}
              haven&apos;t been saved. Switching campaigns will discard them.
            </>
          }
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          destructive
          onConfirm={() => {
            setSelected(pendingSelect);
            setDirty(false);
            setPendingSelect(null);
          }}
          onClose={() => setPendingSelect(null)}
        />
      )}

      {runResult && (
        <RunResultDialog result={runResult} onClose={() => setRunResult(null)} />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3" aria-label="Loading campaigns" role="status">
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rc-skeleton h-[68px]" />
        ))}
      </div>
      <div className="rc-skeleton h-[420px] lg:col-span-2" />
    </div>
  );
}
