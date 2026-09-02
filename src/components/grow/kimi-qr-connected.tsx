/**
 * Backend adapter shell for Kimi grow-qr-codes.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  QrCode as QrIcon, Search, Plus, MoreVertical, Download, Trash2,
  ArrowLeft, ExternalLink,
} from "lucide-react";
import QrGenerator from "@/components/kimi/grow-qr-codes/components/QrGenerator";
import type { Keyword } from "@/components/kimi/grow-qr-codes/mock-data";
import { createQrCode, deleteQrCode, fetchQrCodes, fetchQrKeywords, type QrCodeRow } from "@/lib/growth/kimi-qr-adapter";
import { fetchWebForms } from "@/lib/growth/kimi-forms-adapter";
import { useSearchParams } from "next/navigation";

type View = "list" | "generator";

function formatQrDate(iso?: string): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KimiQrCodesConnected() {
  const searchParams = useSearchParams();
  const queryKeyword = searchParams.get("keyword") ?? undefined;
  const [view, setView] = useState<View>(queryKeyword ? "generator" : "list");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [qrCodes, setQrCodes] = useState<QrCodeRow[]>([]);
  const [webforms, setWebforms] = useState<Array<{ value: string; label: string }>>([]);
  const [defaultKeyword, setDefaultKeyword] = useState<string | undefined>(queryKeyword);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [keywordRows, qrRows, forms] = await Promise.all([
      fetchQrKeywords(),
      fetchQrCodes(),
      fetchWebForms(),
    ]);
    setKeywords(keywordRows);
    setQrCodes(qrRows);
    setWebforms(forms.map((f) => ({ value: f.id, label: f.name })));
  }, []);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  const rows = qrCodes.filter((qr) => {
    const q = query.toLowerCase();
    return qr.name.toLowerCase().includes(q) || qr.targetUrl.toLowerCase().includes(q);
  });

  const openGenerator = (kw?: string) => {
    setDefaultKeyword(kw);
    setMenuFor(null);
    setView("generator");
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
                <ArrowLeft size={15} /> Back to QR Codes
              </button>
              <QrGenerator
                onCancel={() => setView("list")}
                defaultKeyword={defaultKeyword}
                keywordOptions={keywords.map((k) => ({ name: k.name }))}
                webformOptions={webforms}
                onDownload={async ({ action, keyword, webform, url }) => {
                  setError("");
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
                  await reload();
                  setView("list");
                }}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <span>Tools</span><span className="text-border">/</span><span>QR Codes</span>
              </div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                  <QrIcon size={18} />
                </span>
                <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">QR Codes</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Create and manage QR codes for keywords, web forms, and links.</p>

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
                  <Plus size={15} /> Create QR Code
                </button>
              </div>

              <div className="bg-card border border-border rounded-xl shadow-sm overflow-visible">
                <div className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.5fr_44px] items-center px-5 h-11 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase border-b border-border bg-muted/40 rounded-t-xl">
                  <span>Name</span><span>Destination</span><span /><span>Status</span><span />
                </div>
                {rows.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No QR codes yet. Create one to get started.
                  </div>
                ) : (
                  rows.map((qr) => (
                    <div
                      key={qr.id}
                      className="grid grid-cols-[1.1fr_1.7fr_0.8fr_0.5fr_44px] items-center px-5 py-4 border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{qr.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{formatQrDate(qr.createdAt)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground pr-6 leading-snug truncate" title={qr.targetUrl}>
                        {qr.targetUrl}
                      </p>
                      <span className="tv-chip w-fit">{qr.targetType || "url"}</span>
                      <span className={`tv-status ${qr.status === "Active" ? "" : "tv-status-inactive"}`}>
                        {qr.status || "Active"}
                      </span>
                      <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          onClick={() => setMenuFor(menuFor === qr.id ? null : qr.id)}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {menuFor === qr.id && (
                          <div className="tv-popover absolute right-0 top-9 z-30 w-56 py-1.5">
                            {qr.qrImageUrl && (
                              <a
                                className="tv-menu-item"
                                href={qr.qrImageUrl}
                                download={`${qr.name}.png`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download size={14} className="mr-2.5 text-muted-foreground" />Download
                              </a>
                            )}
                            {qr.trackedUrl && (
                              <a
                                className="tv-menu-item"
                                href={qr.trackedUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink size={14} className="mr-2.5 text-muted-foreground" />Open Link
                              </a>
                            )}
                            <button
                              className="tv-menu-item"
                              onClick={() => {
                                const smsMatch = qr.targetUrl.match(/^sms:\?body=(.+)$/i);
                                openGenerator(smsMatch ? decodeURIComponent(smsMatch[1]) : undefined);
                              }}
                            >
                              <QrIcon size={14} className="mr-2.5 text-muted-foreground" />Regenerate
                            </button>
                            <button
                              className="tv-menu-item text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                if (!window.confirm(`Delete QR code "${qr.name}"?`)) return;
                                void deleteQrCode(qr.id)
                                  .then(() => reload())
                                  .then(() => setMenuFor(null))
                                  .catch((err) => setError(err instanceof Error ? err.message : "Could not delete QR code"));
                              }}
                            >
                              <Trash2 size={14} className="mr-2.5" />Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
