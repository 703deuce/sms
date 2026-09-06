"use client";
import { useState } from "react";
import { Search, Plus, Users, MoreVertical, Pencil, Trash2, Eye, PieChart as PieIcon, AlertCircle, RefreshCw } from "lucide-react";
import { Segment } from "../mock-data";

export function PieSlice() {
  return <PieIcon className="h-4 w-4 text-primary" />;
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[1fr_150px_190px_120px_40px] gap-3 px-4 py-3 border-t border-border first:border-t-0 items-center">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-full bg-muted seg-pulse" />
            <span className="h-3.5 w-40 rounded bg-muted seg-pulse" />
          </div>
          <span className="h-3.5 w-16 rounded bg-muted seg-pulse" />
          <span className="h-3.5 w-36 rounded bg-muted seg-pulse" />
          <span className="h-8 w-24 rounded-lg bg-muted seg-pulse" />
          <span />
        </div>
      ))}
    </>
  );
}

export default function SegmentsList({
  segments,
  loading = false,
  error = "",
  onRetry,
  onCreate,
  onEdit,
  onViewContacts,
  onDelete,
}: {
  segments: Segment[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onCreate: () => void;
  onEdit: (s: Segment) => void;
  onViewContacts: (s: Segment) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Segment | null>(null);

  const filtered = segments.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dynamic groups of contacts built from conditions. Membership updates automatically as contacts change.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98] shrink-0"
        >
          <Plus className="h-4 w-4" /> Create Segment
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-red-800">Segments couldn&apos;t be loaded.</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
          {onRetry && (
            <button onClick={onRetry} className="h-8 px-3 rounded-lg border border-red-200 bg-card text-[13px] font-medium text-red-700 hover:bg-red-100/60 flex items-center gap-1.5 transition-colors shrink-0">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          )}
        </div>
      )}

      <div className="relative w-72 mt-5 mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search segments"
          aria-label="Search segments"
          className="seg-input w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="seg-card rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {loading ? (
              <SkeletonRows />
            ) : segments.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto mb-3 h-11 w-11 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 flex items-center justify-center">
                  <PieIcon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">No segments yet</h3>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto">
                  Segments are dynamic groups of contacts based on conditions like state, age, appointment status, or list membership.
                </p>
                <button onClick={onCreate} className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold mt-4 inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Create your first segment
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <h3 className="text-sm font-semibold text-foreground">No segments match “{q}”</h3>
                <p className="text-[13px] text-muted-foreground mt-1">Try a different search term.</p>
                <button onClick={() => setQ("")} className="mt-3 text-[13px] font-medium text-primary hover:underline">Clear search</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_150px_190px_120px_40px] gap-3 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <span>Segment</span>
                  <span>Contacts</span>
                  <span>Created</span>
                  <span></span>
                  <span></span>
                </div>
                {filtered.map((s) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1fr_150px_190px_120px_40px] gap-3 px-4 py-3 border-t border-border first:border-t-0 items-center text-sm transition-colors hover:bg-muted/40 cursor-pointer"
                    onClick={() => onViewContacts(s)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-8 w-8 rounded-full border-2 border-primary/70 flex items-center justify-center shrink-0">
                        <PieSlice />
                      </span>
                      <span className="font-medium text-foreground truncate">{s.name}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
                      <Users className="h-3.5 w-3.5" />
                      {s.contacts.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-[13px]">{s.createdAt}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewContacts(s); }}
                      className="h-8 px-3 rounded-lg border border-border bg-card hover:bg-muted/70 text-[13px] font-medium text-foreground flex items-center gap-1.5 transition-colors w-fit"
                    >
                      <Eye className="h-3.5 w-3.5" /> Contacts
                    </button>
                    <div className="relative">
                      <button
                        aria-label={`More actions for ${s.name}`}
                        className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                        onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === s.id ? null : s.id); }}
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {menuFor === s.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                          <div className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setMenuFor(null); onEdit(s); }}
                              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-primary/5 hover:text-primary transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit Segment
                            </button>
                            <button
                              onClick={() => { setMenuFor(null); onViewContacts(s); }}
                              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-primary/5 hover:text-primary transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Contacts
                            </button>
                            <div className="my-1 border-t border-border" />
                            <button
                              onClick={() => { setMenuFor(null); setConfirmDelete(s); }}
                              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setConfirmDelete(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="seg-del-title" className="relative seg-card rounded-xl border border-border bg-card w-full max-w-sm p-5 seg-fade">
            <h3 id="seg-del-title" className="text-[15px] font-semibold text-foreground">Delete “{confirmDelete.name}”?</h3>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              This segment will be permanently removed. The contacts in it will not be deleted.
            </p>
            <div className="flex justify-end gap-2.5 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-9 px-3.5 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                Delete Segment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
