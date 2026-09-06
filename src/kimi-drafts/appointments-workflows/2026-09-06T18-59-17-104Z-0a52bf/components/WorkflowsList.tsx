"use client";
import React, { useMemo, useState } from "react";
import { Copy, MoreHorizontal, Pencil, Plus, Search, Trash2, Workflow, Zap } from "lucide-react";
import { MOCK_WORKFLOWS, PREBUILT_TEMPLATES, triggerLabel, type WorkflowRecord } from "../mock-data";
import { PrebuiltWorkflowCard } from "./PrebuiltWorkflowCard";
import { Button, Card, ChannelBadge, Input, Modal, StatusChip, cn } from "./ui";

export function WorkflowsList({ onEdit, onCreate, onSetupTemplate, toast }: {
  onEdit: (wf: WorkflowRecord) => void;
  onCreate: () => void;
  onSetupTemplate: (templateId: string) => void;
  toast: (msg: string) => void;
}) {
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(MOCK_WORKFLOWS);
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowRecord | null>(null);

  const installedByTemplate = new Map(workflows.filter((w) => w.templateId).map((w) => [w.templateId!, w]));
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => query
    ? workflows.filter((w) => w.name.toLowerCase().includes(query) || triggerLabel(w.trigger).toLowerCase().includes(query))
    : workflows, [workflows, query]);
  const filteredTemplates = query
    ? PREBUILT_TEMPLATES.filter((t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query))
    : PREBUILT_TEMPLATES;

  function toggleActive(wf: WorkflowRecord) {
    setWorkflows((p) => p.map((w) => w.id === wf.id ? { ...w, active: !w.active, status: !w.active ? "active" : "paused" } : w));
    toast(wf.active ? `"${wf.name}" paused.` : `"${wf.name}" activated.`);
  }
  function duplicate(wf: WorkflowRecord) {
    const copy: WorkflowRecord = { ...wf, id: `wf_${Date.now()}`, name: `${wf.name} (copy)`, active: false, status: "draft", sourceType: "custom", templateId: undefined, executions30d: 0, updatedAt: new Date().toISOString() };
    setWorkflows((p) => [copy, ...p]);
    setMenuFor(null);
    toast(`Duplicated as "${copy.name}".`);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    setWorkflows((p) => p.filter((w) => w.id !== deleteTarget.id));
    toast(`"${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  }

  const activeCount = workflows.filter((w) => w.active).length;
  const runs = workflows.reduce((a, w) => a + w.executions30d, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Automated appointment reminders, confirmations, and follow-ups.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows…" className="pl-9 sm:w-60" aria-label="Search workflows" />
          </div>
          <Button onClick={onCreate}><Plus className="h-4 w-4" /> Create custom workflow</Button>
        </div>
      </div>

      {/* Quiet stats */}
      <div className="mt-6 grid grid-cols-3 gap-3 max-w-xl">
        {[
          { label: "Workflows", value: String(workflows.length) },
          { label: "Active", value: String(activeCount) },
          { label: "Runs · 30 days", value: runs.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="surface rounded-xl bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{s.label}</p>
            <p className="mt-0.5 font-display text-xl font-semibold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recommended */}
      {filteredTemplates.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Recommended workflows</h2>
            <span className="text-xs text-[var(--muted-foreground)]">{filteredTemplates.length} templates</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((t) => (
              <PrebuiltWorkflowCard key={t.id} template={t} installed={installedByTemplate.get(t.id)} onSetup={() => onSetupTemplate(t.id)} />
            ))}
          </div>
        </section>
      )}

      {/* My workflows */}
      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-semibold tracking-tight">My workflows</h2>
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--muted)]">
              <Workflow className="h-5 w-5 text-[var(--muted-foreground)]" />
            </div>
            {query ? (
              <>
                <p className="mt-3 text-sm font-semibold">No workflows match “{search}”</p>
                <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">Try a different search, or clear it to see everything.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearch("")}>Clear search</Button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold">No custom workflows yet</p>
                <p className="mt-1 max-w-sm text-[13px] text-[var(--muted-foreground)]">
                  Set up a recommended workflow above, or build your own sequence of appointment messages and actions.
                </p>
                <Button size="sm" className="mt-4" onClick={onCreate}><Plus className="h-4 w-4" /> Create custom workflow</Button>
              </>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((wf) => (
              <div key={wf.id} className="surface group flex items-center gap-4 rounded-xl bg-white px-4 py-3.5 transition-all duration-150 hover:border-[#2547e04d]">
                <button
                  onClick={() => toggleActive(wf)}
                  aria-label={wf.active ? `Pause ${wf.name}` : `Activate ${wf.name}`}
                  className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    wf.active ? "bg-[var(--success-bg)] text-[var(--success)]" : "bg-[#f2f4f7] text-[#98a2b3] hover:text-[#475467]")}>
                  <Zap className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onEdit(wf)}>
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold tracking-tight">{wf.name}</p>
                    <StatusChip tone={wf.status === "active" ? "success" : wf.status === "paused" ? "neutral" : "warning"} dot>
                      {wf.status === "active" ? "Active" : wf.status === "paused" ? "Paused" : "Draft"}
                    </StatusChip>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                    <span>{triggerLabel(wf.trigger)}</span><span>·</span>
                    {wf.channels.map((c) => <ChannelBadge key={c} channel={c} />)}<span>·</span>
                    <span>{wf.steps.length} {wf.steps.length === 1 ? "step" : "steps"}</span><span>·</span>
                    <span>{wf.executions30d} runs / 30d</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => onEdit(wf)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  <div className="relative">
                    <Button variant="ghost" size="icon" aria-label={`More actions for ${wf.name}`} onClick={() => setMenuFor(menuFor === wf.id ? null : wf.id)}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuFor === wf.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                        <div className="fade-in absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium hover:bg-[var(--muted)]" onClick={() => duplicate(wf)}>
                            <Copy className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /> Duplicate
                          </button>
                          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium hover:bg-[var(--muted)]" onClick={() => { toggleActive(wf); setMenuFor(null); }}>
                            <Zap className="h-3.5 w-3.5 text-[var(--muted-foreground)]" /> {wf.active ? "Pause" : "Activate"}
                          </button>
                          <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[var(--danger)] hover:bg-[#fef3f2]" onClick={() => { setDeleteTarget(wf); setMenuFor(null); }}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`Delete "${deleteTarget?.name}"?`}
        subtitle="This permanently removes the workflow and stops any pending steps for upcoming appointments. Past message history is kept."
        footer={<>
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Keep workflow</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete workflow</Button>
        </>}>
        <p className="text-sm text-[var(--muted-foreground)]">This action can't be undone. You can duplicate the workflow first if you want a backup.</p>
      </Modal>
    </div>
  );
}
