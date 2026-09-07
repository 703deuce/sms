"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import "@/components/appointments/kimi-ui/recall-campaigns/reference.css";
import type { RecallCampaign } from "@/components/appointments/kimi-ui/recall-campaigns/types";
import { CampaignList } from "@/components/appointments/kimi-ui/recall-campaigns/components/CampaignList";
import { CampaignEditor } from "@/components/appointments/kimi-ui/recall-campaigns/components/CampaignEditor";
import { RunResultDialog } from "@/components/appointments/kimi-ui/recall-campaigns/components/RunResultDialog";
import { ConfirmDialog } from "@/components/appointments/kimi-ui/recall-campaigns/components/ConfirmDialog";
import { EmptyState } from "@/components/appointments/kimi-ui/recall-campaigns/components/EmptyState";

type LoadState = "loading" | "ready" | "empty" | "error";

export function RecallCampaignsConnected() {
  const [campaigns, setCampaigns] = useState<RecallCampaign[]>([]);
  const [selected, setSelected] = useState<RecallCampaign | null>(null);
  const [acting, setActing] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [runResult, setRunResult] = useState<{ sent: number; targeted: number; name: string } | null>(null);
  const [runConfirm, setRunConfirm] = useState<RecallCampaign | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RecallCampaign | null>(null);
  const [pendingSelect, setPendingSelect] = useState<RecallCampaign | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(() => {
    setLoadState("loading");
    fetch("/api/appointments/recall-campaigns")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((j) => {
        const data = (j.data || []) as RecallCampaign[];
        setCampaigns(data);
        setSelected((prev) => {
          if (prev) return data.find((c) => c.id === prev.id) ?? data[0] ?? null;
          return data[0] ?? null;
        });
        setLoadState(data.length === 0 ? "empty" : "ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!selected) return;
    setActing(true);
    await fetch("/api/appointments/recall-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign: selected }),
    });
    setActing(false);
    setDirty(false);
    setNotice({ kind: "success", text: "Campaign saved." });
    load();
  }

  async function runConfirmed() {
    const campaign = runConfirm;
    if (!campaign) return;
    setActing(true);
    const res = await fetch("/api/appointments/recall-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", campaignId: campaign.id }),
    });
    const json = await res.json();
    setActing(false);
    setRunConfirm(null);
    if (json.data) {
      setRunResult({
        sent: json.data.sent ?? 0,
        targeted: json.data.targeted ?? 0,
        name: campaign.name,
      });
    }
    load();
  }

  async function create() {
    setActing(true);
    const res = await fetch("/api/appointments/recall-campaigns", { method: "POST", body: "{}" });
    const json = await res.json();
    setActing(false);
    if (json.data) {
      setSelected(json.data);
      setDirty(true);
      load();
    }
  }

  async function deleteConfirmed() {
    const campaign = deleteConfirm;
    if (!campaign) return;
    setActing(true);
    const res = await fetch(
      `/api/appointments/recall-campaigns?id=${encodeURIComponent(campaign.id)}`,
      { method: "DELETE" },
    );
    setActing(false);
    setDeleteConfirm(null);
    if (!res.ok) {
      setNotice({ kind: "error", text: "Could not delete campaign. Try again." });
      return;
    }
    setDirty(false);
    setNotice({ kind: "success", text: `"${campaign.name}" was deleted.` });
    load();
  }

  const updateSelected = useCallback((next: RecallCampaign) => {
    setSelected(next);
    setDirty(true);
  }, []);

  const requestSelect = useCallback(
    (c: RecallCampaign) => {
      if (dirty && c.id !== selected?.id) setPendingSelect(c);
      else {
        setSelected(c);
        setDirty(false);
      }
    },
    [dirty, selected?.id],
  );

  const stats = useMemo(() => {
    const active = campaigns.filter((c) => c.active).length;
    const totalSent = campaigns.reduce((n, c) => n + (c.lastRunSent ?? 0), 0);
    return { active, totalSent, total: campaigns.length };
  }, [campaigns]);

  return (
    <div className="rc-shell">
      <main className="mx-auto max-w-6xl px-6 py-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Recall campaigns</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Re-engage customers who haven&apos;t visited in a while. Target contacts by last visit or appointment type.
            </p>
          </div>
          <button
            type="button"
            onClick={create}
            disabled={acting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New campaign
          </button>
        </div>

        {loadState === "ready" && campaigns.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Campaigns", value: String(stats.total) },
              { label: "Active", value: String(stats.active) },
              { label: "Messages sent (all runs)", value: stats.totalSent.toLocaleString("en-US") },
            ].map((s) => (
              <div key={s.label} className="surface rounded-xl bg-card px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-display text-xl font-semibold tracking-tight">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {notice && (
          <div className={`rc-banner mt-4 ${notice.kind === "success" ? "rc-banner-success" : "rc-banner-error"}`} role="status">
            <span>{notice.text}</span>
          </div>
        )}

        <div className="mt-5">
          {loadState === "loading" && (
            <div className="grid items-start gap-4 lg:grid-cols-3" aria-busy="true">
              <div className="rc-skeleton h-[200px]" />
              <div className="rc-skeleton h-[420px] lg:col-span-2" />
            </div>
          )}

          {loadState === "error" && (
            <div className="surface rounded-xl bg-card p-10 text-center">
              <TriangleAlert className="mx-auto h-8 w-8 text-[hsl(var(--warning))]" />
              <h2 className="mt-3 font-display text-base font-semibold">Recall campaigns couldn&apos;t be loaded</h2>
              <button type="button" onClick={load} className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </div>
          )}

          {loadState === "empty" && <EmptyState onCreate={create} acting={acting} />}

          {loadState === "ready" && campaigns.length > 0 && (
            <div className="grid items-start gap-4 lg:grid-cols-3">
              <CampaignList campaigns={campaigns} selectedId={selected?.id ?? null} onSelect={requestSelect} />
              {selected ? (
                <CampaignEditor
                  key={selected.id}
                  campaign={selected}
                  acting={acting}
                  dirty={dirty}
                  onChange={updateSelected}
                  onSave={save}
                  onRun={() => setRunConfirm(selected)}
                  onDelete={() => setDeleteConfirm(selected)}
                />
              ) : (
                <div className="surface rounded-xl bg-card p-10 text-center lg:col-span-2">
                  <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Select a campaign to edit its settings.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {runConfirm && (
        <ConfirmDialog
          title={`Run "${runConfirm.name}" now?`}
          body="This will message every contact matching the current audience."
          confirmLabel="Run campaign"
          busy={acting}
          onConfirm={runConfirmed}
          onClose={() => setRunConfirm(null)}
        />
      )}
      {deleteConfirm && (
        <ConfirmDialog
          title={`Delete "${deleteConfirm.name}"?`}
          body="This permanently removes the campaign's settings and run history."
          confirmLabel="Delete campaign"
          destructive
          busy={acting}
          onConfirm={deleteConfirmed}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
      {pendingSelect && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          body="Switching campaigns will discard unsaved edits."
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
      {runResult && <RunResultDialog result={runResult} onClose={() => setRunResult(null)} />}
    </div>
  );
}
