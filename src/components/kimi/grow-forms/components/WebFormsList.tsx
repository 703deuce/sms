"use client";
import React, { useEffect, useState } from "react";
import { Search, Plus, MoreVertical, Pencil, Code2, Copy, Trash2, LayoutList, ListChecks, ExternalLink } from "lucide-react";
import { webForms as seedForms, WebForm } from "../mock-data";

export default function WebFormsList({
  forms: formsProp,
  onCreate,
  onDelete,
  onEdit,
  onClone,
  onCopyEmbed,
  onOpenForm,
}: {
  forms?: WebForm[];
  onCreate: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onClone?: (id: string) => void;
  onCopyEmbed?: (id: string) => void | Promise<void>;
  onOpenForm?: (id: string) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rows, setRows] = useState<WebForm[]>(formsProp ?? seedForms);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (formsProp) setRows(formsProp);
  }, [formsProp]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="tv-forms mx-auto max-w-[1200px] px-6 py-8 lg:px-10" onClick={() => menuFor && setMenuFor(null)}>
      {/* Breadcrumb + header */}
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
        Grow <span className="mx-0.5 text-muted-foreground/50">/</span> Forms
      </div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 font-display text-[22px] font-semibold tracking-tight text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <LayoutList size={17} />
            </span>
            Web Forms
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            View and manage all of your web forms.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search forms"
              className="h-9 w-56 rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] shadow-sm transition placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            onClick={onCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] active:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            <Plus size={15} strokeWidth={2.5} /> Create Web Form
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="surface overflow-visible rounded-xl bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="rounded-tl-xl px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Connected Lists</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="w-12 rounded-tr-xl px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr
                key={f.id}
                className="group/row cursor-pointer border-b border-border transition-colors duration-150 last:border-0 hover:bg-muted/30"
                onClick={() => onEdit?.(f.id)}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`tv-thumb tv-thumb-${f.thumb} flex-none`} />
                    <div className="min-w-0">
                      <div className="group flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                        <span className="truncate">{f.name}</span>
                        <Pencil size={11} className="flex-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground/80">Last saved on {f.lastSaved}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-[13px] text-muted-foreground">
                  {f.description || (
                    <span className="inline-flex cursor-pointer items-center gap-1 text-[13px] text-primary transition-colors hover:text-primary-hover hover:underline">
                      Add Description <Pencil size={11} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-foreground/90">{f.type}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
                      <ListChecks size={13} />
                    </span>
                    <span className={f.connectedLists === 0 ? "text-muted-foreground/70" : ""}>
                      {f.connectedLists} Connected List{f.connectedLists === 1 ? "" : "s"}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {f.status === "Active" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="relative px-4 py-3.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === f.id ? null : f.id); }}
                    className="rounded-md p-1.5 text-muted-foreground opacity-60 transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
                    aria-label="Form actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuFor === f.id && (
                    <div
                      className="tv-pop absolute right-4 top-10 z-20 w-52 overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted" onClick={() => { setMenuFor(null); onEdit?.(f.id); }}><Pencil size={14} className="text-muted-foreground" /> Edit</button>
                      {f.publicUrl && (
                        <button
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                          onClick={() => { setMenuFor(null); onOpenForm?.(f.id); }}
                        >
                          <ExternalLink size={14} className="text-muted-foreground" /> Open Form
                        </button>
                      )}
                      <button
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                        onClick={() => { setMenuFor(null); void onCopyEmbed?.(f.id); }}
                      >
                        <Code2 size={14} className="text-muted-foreground" /> Copy Embed Code
                      </button>
                      <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted" onClick={() => { setMenuFor(null); onClone?.(f.id); }}><Copy size={14} className="text-muted-foreground" /> Clone</button>
                      <div className="mx-3 my-1.5 border-t border-border" />
                      <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50" onClick={() => { setRows((r) => r.filter((x) => x.id !== f.id)); setMenuFor(null); onDelete?.(f.id); }}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="mx-auto mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <LayoutList size={20} />
                  </div>
                  <div className="font-display text-sm font-semibold text-foreground">No forms found</div>
                  <div className="mt-1.5 text-[13px] text-muted-foreground">Try a different search term or create a new web form.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2.5 rounded-b-xl border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <select className="h-7 rounded-md border border-border bg-card px-2 text-xs shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <span className="ml-auto tabular-nums">{filtered.length} form{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
