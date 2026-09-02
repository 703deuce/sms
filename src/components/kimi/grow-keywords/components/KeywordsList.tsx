"use client";

import { useEffect, useState } from "react";
import {
  Search,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Copy,
  QrCode,
  MousePointerClick,
  Trash2,
  List,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { keywords as initialKeywords, Keyword } from "../mock-data";

function StatusPill({ status }: { status: Keyword["status"] }) {
  const active = status === "Active";
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15"
          : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground ring-1 ring-inset ring-border"
      }
    >
      <span
        className={
          active
            ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
            : "h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
        }
      />
      {status}
    </span>
  );
}

export default function KeywordsList({
  keywords: keywordsProp,
  onCreate,
  onDelete,
  onClone,
  onEdit,
  onCreateQr,
  onCreateTap,
}: {
  keywords?: Keyword[];
  onCreate: () => void;
  onDelete?: (id: string) => void;
  onClone?: (id: string) => void;
  onEdit?: (id: string) => void;
  onCreateQr?: (id: string) => void;
  onCreateTap?: (id: string) => void;
}) {
  const [keywords, setKeywords] = useState<Keyword[]>(keywordsProp !== undefined ? keywordsProp : initialKeywords);
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (keywordsProp !== undefined) setKeywords(keywordsProp);
  }, [keywordsProp]);

  const filtered = keywords.filter(
    (k) =>
      k.name.toLowerCase().includes(query.toLowerCase()) ||
      k.description.toLowerCase().includes(query.toLowerCase())
  );

  const menuAction = (action: string, id: string) => {
    if (action === "Delete") {
      if (onDelete) {
        onDelete(id);
      } else {
        setKeywords((ks) => ks.filter((k) => k.id !== id));
      }
    }
    if (action === "Clone") {
      if (onClone) {
        onClone(id);
      } else {
        const src = keywords.find((k) => k.id === id);
        if (src)
          setKeywords((ks) => [
            { ...src, id: `${src.id}-copy-${Date.now()}`, name: `${src.name}Copy` },
            ...ks,
          ]);
      }
    }
    if (action === "Edit" && onEdit) onEdit(id);
    if (action === "QR" && onCreateQr) onCreateQr(id);
    if (action === "Tap" && onCreateTap) onCreateTap(id);
    setOpenMenu(null);
  };

  return (
    <div className="kw-fade" onClick={() => openMenu && setOpenMenu(null)}>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        <span className="transition-colors hover:text-foreground">Grow</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground">Keywords</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquareText size={19} className="text-primary" />
          </div>
          <div>
            <h1 className="font-display text-[20px] font-semibold tracking-tight text-foreground">
              Keywords
            </h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              View and manage all of your keywords.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            />
            <input
              className="h-9 w-[220px] rounded-lg border border-border bg-card pl-8.5 pr-3 text-[13px] text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-ring/30"
              style={{ paddingLeft: 32 }}
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98]"
            onClick={onCreate}
          >
            Create Keyword
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="surface overflow-visible rounded-xl bg-card">
        <div className="kw-table-head border-b border-border px-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            Keyword <ArrowUpDown size={11} className="text-muted-foreground/60" />
          </span>
          <span>Description</span>
          <span />
          <span className="flex items-center gap-1.5">
            Status <ArrowUpDown size={11} className="text-muted-foreground/60" />
          </span>
          <span />
        </div>

        {filtered.map((k) => (
          <div
            key={k.id}
            className="kw-row border-b border-border/60 px-5 transition-colors last:border-b-0 hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-foreground">
                {k.name}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                {k.lastSaved}
              </div>
            </div>
            <div className="min-w-0 pr-6 text-[13px] leading-relaxed text-muted-foreground">
              {k.description}
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <List size={12} className="text-primary" />
              </span>
              <span>
                <strong className="font-semibold text-foreground">
                  {k.connectedLists}
                </strong>{" "}
                Connected {k.connectedLists === 1 ? "List" : "Lists"}
              </span>
            </div>
            <div>
              <StatusPill status={k.status} />
            </div>
            <div className="relative flex justify-end">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === k.id ? null : k.id);
                }}
                aria-label="Keyword actions"
                aria-expanded={openMenu === k.id}
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === k.id && (
                <div
                  className="kw-dropdown kw-fade absolute right-0 top-[calc(100%+4px)] z-40 w-56 overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { action: "Edit", icon: Pencil, label: "Edit" },
                    { action: "Clone", icon: Copy, label: "Clone" },
                    { action: "QR", icon: QrCode, label: "Create QR Code" },
                    {
                      action: "Tap",
                      icon: MousePointerClick,
                      label: "Create Tap-to-Join Link",
                    },
                  ].map(({ action, icon: Icon, label }) => (
                    <button
                      key={action}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                      onClick={() => menuAction(action, k.id)}
                    >
                      <Icon size={14} className="text-muted-foreground" /> {label}
                    </button>
                  ))}
                  <div className="my-1.5 border-t border-border" />
                  <button
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-danger transition-colors hover:bg-danger/10"
                    onClick={() => menuAction("Delete", k.id)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquareText size={20} className="text-primary" />
            </div>
            <div className="font-display text-sm font-semibold text-foreground">
              No keywords found
            </div>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              {query
                ? "Try a different search term."
                : "Create your first keyword to get started."}
            </p>
            {!query && (
              <button
                className="mt-5 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
                onClick={onCreate}
              >
                Create Keyword
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-[12px] text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "keyword" : "keywords"}
          </span>
          <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60">
            25 Per Page <ChevronDown size={13} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
