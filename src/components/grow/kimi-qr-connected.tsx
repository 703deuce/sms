/**
 * Backend adapter shell for Kimi grow-qr-codes.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  QrCode as QrIcon, Search, Plus, MoreVertical, Pencil, Copy, Link2, Trash2,
  ListChecks, ArrowLeft,
} from "lucide-react";
import QrGenerator from "@/components/kimi/grow-qr-codes/components/QrGenerator";
import type { Keyword } from "@/components/kimi/grow-qr-codes/mock-data";
import { createQrCode, fetchQrKeywords } from "@/lib/growth/kimi-qr-adapter";
import { cloneKeyword, deleteKeyword } from "@/lib/growth/kimi-keywords-adapter";
import { fetchWebForms } from "@/lib/growth/kimi-forms-adapter";
import { useSearchParams } from "next/navigation";

type View = "list" | "generator";

export function KimiQrCodesConnected() {
  const searchParams = useSearchParams();
  const queryKeyword = searchParams.get("keyword") ?? undefined;
  const [view, setView] = useState<View>(queryKeyword ? "generator" : "list");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [webforms, setWebforms] = useState<Array<{ value: string; label: string }>>([]);
  const [defaultKeyword, setDefaultKeyword] = useState<string | undefined>(queryKeyword);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [rows, forms] = await Promise.all([fetchQrKeywords(), fetchWebForms()]);
    setKeywords(rows);
    setWebforms(forms.map((f) => ({ value: f.id, label: f.name })));
  }, []);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const rows = keywords.filter((k) => k.name.toLowerCase().includes(query.toLowerCase()));

  const openGenerator = (kw?: Keyword) => {
    setDefaultKeyword(kw?.name);
    setMenuFor(null);
    setView("generator");
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await deleteKeyword(id);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      setMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleClone = async (id: string) => {
    setError("");
    try {
      await cloneKeyword(id, keywords.map((k) => ({
        id: k.id,
        name: k.name,
        description: k.description,
        lastSaved: k.lastSaved,
        connectedLists: k.connectedLists,
        status: k.status,
      })));
      await reload();
      setMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
    }
  };

  return (
    <div className="tv-shell">
      <main className="flex-1 overflow-y-auto" onClick={() => setMenuFor(null)}>
        <div className="max-w-[1100px] mx-auto px-8 py-7">
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          {view === "generator" ? (
            <>
              <button
                className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-5"
                onClick={() => setView("list")}
              >
                <ArrowLeft size={15} /> Back to Keywords
              </button>
              <QrGenerator
                onCancel={() => setView("list")}
                defaultKeyword={defaultKeyword}
                keywordOptions={keywords.map((k) => ({ name: k.name }))}
                webformOptions={webforms}
                onDownload={async ({ action, keyword, webform, url }) => {
                  const targetUrl =
                    action === "url"
                      ? url
                      : action === "webform"
                        ? `/forms/${webform}`
                        : `sms:?body=${encodeURIComponent(keyword)}`;
                  await createQrCode({
                    name: `QR ${action === "keyword" ? keyword : action === "webform" ? webform : "link"}`,
                    targetUrl,
                    targetType: action,
                  });
                }}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <span>Tools</span><span className="text-border">/</span><span>Keywords</span>
              </div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <QrIcon size={18} />
                </span>
                <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">QR Codes</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-6">View and manage all of your keywords &amp; QR codes.</p>

              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="tv-input pl-9 w-72"
                    placeholder="Search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button className="tv-btn-primary flex items-center gap-1.5" onClick={() => openGenerator()}>
                  <Plus size={15} /> Create Keyword
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm overflow-visible">
                <div className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.5fr_44px] items-center px-5 h-11 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase border-b border-border bg-muted/40 rounded-t-xl">
                  <span>Keyword</span><span>Description</span><span /><span>Status</span><span />
                </div>
                {rows.map((k) => (
                  <div
                    key={k.id}
                    className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.5fr_44px] items-center px-5 py-4 border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{k.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{k.lastSaved}</p>
                    </div>
                    <p className="text-sm text-muted-foreground pr-6 leading-snug">{k.description}</p>
                    <span className="tv-chip w-fit"><ListChecks size={12} className="mr-1.5" />{k.connectedLists} Connected List</span>
                    <span className={`tv-status ${k.status === "Active" ? "" : "tv-status-inactive"}`}>{k.status}</span>
                    <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setMenuFor(menuFor === k.id ? null : k.id)}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuFor === k.id && (
                        <div className="tv-popover absolute right-0 top-9 z-30 w-56 py-1.5">
                          <button className="tv-menu-item" onClick={() => openGenerator(k)}><Pencil size={14} className="mr-2.5 text-muted-foreground" />Edit</button>
                          <button className="tv-menu-item" onClick={() => void handleClone(k.id)}><Copy size={14} className="mr-2.5 text-muted-foreground" />Clone</button>
                          <button className="tv-menu-item" onClick={() => openGenerator(k)}><QrIcon size={14} className="mr-2.5 text-muted-foreground" />Create QR Code</button>
                          <button className="tv-menu-item" onClick={() => window.location.assign("/grow/tap-to-join")}><Link2 size={14} className="mr-2.5 text-muted-foreground" />Create Tap-to-Join Link</button>
                          <div className="my-1.5 border-t border-border" />
                          <button className="tv-menu-item text-red-600" onClick={() => void handleDelete(k.id)}><Trash2 size={14} className="mr-2.5" />Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-5 py-3 border-t border-border">
                  <select className="tv-input w-auto text-[13px] py-1.5 pr-8 text-muted-foreground">
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
