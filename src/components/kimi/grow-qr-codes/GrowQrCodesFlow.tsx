/**
 * Kimi session 2026-08-31T00-27-02-641Z-bd7a3c — UI from Kimi draft (mock data, no backend wiring yet).
 */
'use client';
import { useState } from 'react';
import {
  QrCode as QrIcon, Search, Plus, MoreVertical, Pencil, Copy, Link2, Trash2,
  ListChecks, ArrowLeft,
} from 'lucide-react';
import QrGenerator from './components/QrGenerator';
import { keywords, Keyword } from './mock-data';

type View = 'list' | 'generator';

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
        <div className="max-w-[1100px] mx-auto px-8 py-6">
          {view === 'generator' ? (
            <>
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4" onClick={() => setView('list')}>
                <ArrowLeft size={15} /> Back to Keywords
              </button>
              <QrGenerator onCancel={() => setView('list')} defaultKeyword={defaultKeyword} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <span>Tools</span><span>/</span><span>Keywords</span>
              </div>
              <div className="flex items-center gap-2.5 mb-1">
                <QrIcon size={22} className="text-foreground" />
                <h1 className="text-xl font-semibold text-foreground">QR Codes</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-5">View and manage all of your keywords &amp; QR codes.</p>

              <div className="flex items-center justify-between mb-4">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="tv-input pl-9 w-64"
                    placeholder="Search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button className="tv-btn-primary flex items-center gap-1.5" onClick={() => openGenerator()}>
                  <Plus size={15} /> Create Keyword
                </button>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-visible">
                <div className="grid grid-cols-[1.2fr_1.6fr_0.7fr_0.5fr_40px] px-5 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase border-b border-border">
                  <span>Keyword</span><span>Description</span><span /><span>Status</span><span />
                </div>
                {rows.map((k) => (
                  <div key={k.id} className="grid grid-cols-[1.2fr_1.6fr_0.7fr_0.5fr_40px] items-center px-5 py-4 border-b border-border last:border-0 hover:bg-accent/40">
                    <div>
                      <p className="text-sm font-medium text-foreground">{k.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{k.lastSaved}</p>
                    </div>
                    <p className="text-sm text-muted-foreground pr-6">{k.description}</p>
                    <span className="tv-chip w-fit"><ListChecks size={12} className="mr-1" />{k.connectedLists} Connected List</span>
                    <span className="tv-status">{k.status}</span>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button className="p-1.5 rounded hover:bg-accent" onClick={() => setMenuFor(menuFor === k.id ? null : k.id)}>
                        <MoreVertical size={16} className="text-muted-foreground" />
                      </button>
                      {menuFor === k.id && (
                        <div className="tv-popover absolute right-0 z-30 w-52 py-1">
                          <button className="tv-menu-item"><Pencil size={14} className="mr-2" />Edit</button>
                          <button className="tv-menu-item"><Copy size={14} className="mr-2" />Clone</button>
                          <button className="tv-menu-item" onClick={() => openGenerator(k)}><QrIcon size={14} className="mr-2" />Create QR Code</button>
                          <button className="tv-menu-item"><Link2 size={14} className="mr-2" />Create Tap-to-Join Link</button>
                          <button className="tv-menu-item text-red-600"><Trash2 size={14} className="mr-2" />Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3">
                  <select className="tv-input w-auto text-sm py-1.5">
                    <option>25 Per Page</option><option>50 Per Page</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
