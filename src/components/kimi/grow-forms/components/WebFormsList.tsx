"use client";
import React, { useEffect, useState } from "react";
import { Search, Plus, MoreVertical, Pencil, Code2, Copy, Trash2, LayoutList, ListChecks } from "lucide-react";
import { webForms as seedForms, WebForm } from "../mock-data";

export default function WebFormsList({
  forms: formsProp,
  onCreate,
  onDelete,
  onEdit,
  onClone,
}: {
  forms?: WebForm[];
  onCreate: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onClone?: (id: string) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [rows, setRows] = useState<WebForm[]>(formsProp ?? seedForms);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (formsProp) setRows(formsProp);
  }, [formsProp]);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="tv-forms mx-auto max-w-[1200px] p-6 lg:p-8" onClick={() => menuFor && setMenuFor(null)}>
      <div className="mb-1 text-xs text-muted-foreground">Grow / Forms</div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
              <LayoutList size={16} />
            </span>
            Web Forms
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">View and manage all of your web forms.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-52 rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
            />
          </div>
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <Plus size={15} /> Create Web Form
          </button>
        </div>
      </div>

      <div className="overflow-visible rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="rounded-tl-xl px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Connected Lists</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="w-12 rounded-tr-xl px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`tv-thumb tv-thumb-${f.thumb}`} />
                    <div className="min-w-0">
                      <div className="group flex items-center gap-1.5 font-medium text-foreground">
                        <span className="truncate">{f.name}</span>
                        <Pencil size={11} className="flex-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Last saved on {f.lastSaved}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {f.description || (
                    <span className="flex cursor-pointer items-center gap-1 text-indigo-600 transition-colors hover:text-indigo-700 hover:underline">
                      Add Description <Pencil size={11} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground">{f.type}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-indigo-100 bg-indigo-50 text-indigo-600">
                      <ListChecks size={13} />
                    </span>
                    <span className={f.connectedLists === 0 ? "text-muted-foreground/80" : ""}>
                      {f.connectedLists} Connected List{f.connectedLists === 1 ? "" : "s"}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {f.status}
                  </span>
                </td>
                <td className="relative px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === f.id ? null : f.id); }}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    aria-label="Form actions"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuFor === f.id && (
                    <div
                      className="tv-pop absolute right-4 top-10 z-20 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={() => { setMenuFor(null); onEdit?.(f.id); }}><Pencil size={14} className="text-muted-foreground" /> Edit</button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={() => setMenuFor(null)}><Code2 size={14} className="text-muted-foreground" /> Copy Embed Code</button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted" onClick={() => { setMenuFor(null); onClone?.(f.id); }}><Copy size={14} className="text-muted-foreground" /> Clone</button>
                      <div className="my-1 border-t border-border" />
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50" onClick={() => { setRows((r) => r.filter((x) => x.id !== f.id)); setMenuFor(null); onDelete?.(f.id); }}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50">
                    <LayoutList size={20} className="text-indigo-500" />
                  </div>
                  <div className="text-sm font-medium text-foreground">No forms found</div>
                  <div className="mt-1 text-xs text-muted-foreground">Try a different search term or create a new web form.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-2 rounded-b-xl border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <select className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/25">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <span className="ml-auto">{filtered.length} form{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
