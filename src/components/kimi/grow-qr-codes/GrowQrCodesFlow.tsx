/**
 * Kimi session 2026-08-31T00-27-02-641Z-bd7a3c — UI from Kimi draft (mock data, no backend wiring yet).
 */
'use client';
import { useState } from 'react';
import {
  QrCode as QrIcon, Search, Plus, MoreVertical, Pencil, Copy, Link2, Trash2,
  ListChecks, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import QrGenerator from './components/QrGenerator';
import { keywords, Keyword } from './mock-data';

type View = 'list' | 'generator';

function StatusPill({ status }: { status: Keyword['status'] }) {
  const active = status === 'Active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15'
          : 'bg-muted text-muted-foreground ring-1 ring-inset ring-border'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground/60'}`} />
      {status}
    </span>
  );
}

export default function GrowQrCodesFlow() {
  const [view, setView] = useState<View>('list');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [defaultKeyword, setDefaultKeyword] = useState<string | undefined>();

  const rows = keywords.filter((k) => k.name.toLowerCase().includes(query.toLowerCase()));

  const openGenerator = (kw?: Keyword) => {
    setDefaultKeyword(kw?.name);
    setMenuFor(null);
    setView('generator');
  };

  return (
    <div className="tv-shell">
      <main className="flex-1 overflow-y-auto" onClick={() => setMenuFor(null)}>
        <div className="mx-auto max-w-[1100px] px-8 py-7">
          {view === 'generator' ? (
            <>
              <button
                className="mb-5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setView('list')}
              >
                <ArrowLeft size={15} /> Back to Keywords
              </button>
              <QrGenerator onCancel={() => setView('list')} defaultKeyword={defaultKeyword} />
            </>
          ) : (
            <>
              <nav className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="transition-colors hover:text-foreground">Tools</span>
                <span className="text-border">/</span>
                <span className="text-foreground">Keywords</span>
              </nav>

              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <QrIcon size={18} />
                    </span>
                    <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
                      QR Codes
                    </h1>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    View and manage all of your keywords &amp; QR codes.
                  </p>
                </div>
                <Button className="mt-1" onClick={() => openGenerator()}>
                  <Plus size={15} /> Create Keyword
                </Button>
              </div>

              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="tv-input w-72 pl-9"
                    placeholder="Search keywords"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {rows.length} {rows.length === 1 ? 'keyword' : 'keywords'}
                </p>
              </div>

              <div className="surface overflow-visible rounded-xl bg-card">
                <div className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.5fr_44px] items-center gap-3 rounded-t-xl border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <span>Keyword</span>
                  <span>Description</span>
                  <span>Lists</span>
                  <span>Status</span>
                  <span />
                </div>

                {rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                    <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Search size={18} />
                    </div>
                    <h3 className="font-display text-sm font-semibold text-foreground">No keywords found</h3>
                    <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                      No keywords match “{query}”. Try a different search term.
                    </p>
                  </div>
                ) : (
                  rows.map((k) => (
                    <div
                      key={k.id}
                      className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.5fr_44px] items-center gap-3 border-b border-border px-5 py-3.5 transition-colors last:border-0 hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{k.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{k.lastSaved}</p>
                      </div>
                      <p className="pr-6 text-[13px] leading-snug text-muted-foreground">{k.description}</p>
                      <span className="tv-chip w-fit">
                        <ListChecks size={12} className="mr-1.5" />
                        {k.connectedLists} Connected List
                      </span>
                      <StatusPill status={k.status} />
                      <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          onClick={() => setMenuFor(menuFor === k.id ? null : k.id)}
                          aria-label="Keyword actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuFor === k.id && (
                          <div className="tv-popover absolute right-0 top-9 z-30 w-56 py-1.5">
                            <button className="tv-menu-item"><Pencil size={14} className="mr-2.5 text-muted-foreground" />Edit</button>
                            <button className="tv-menu-item"><Copy size={14} className="mr-2.5 text-muted-foreground" />Clone</button>
                            <button className="tv-menu-item" onClick={() => openGenerator(k)}><QrIcon size={14} className="mr-2.5 text-muted-foreground" />Create QR Code</button>
                            <button className="tv-menu-item"><Link2 size={14} className="mr-2.5 text-muted-foreground" />Create Tap-to-Join Link</button>
                            <div className="my-1.5 border-t border-border" />
                            <button className="tv-menu-item text-red-600 hover:bg-red-50"><Trash2 size={14} className="mr-2.5" />Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                <div className="flex items-center justify-between border-t border-border px-5 py-3">
                  <select className="tv-input w-auto py-1.5 pr-8 text-[13px] text-muted-foreground">
                    <option>25 Per Page</option>
                    <option>50 Per Page</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Showing {rows.length} of {keywords.length}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
