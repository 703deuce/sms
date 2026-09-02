"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointerClick, Info, Smartphone, Search, ChevronDown, Check } from "lucide-react";
import { Keyword, TapLink } from "../mock-data";

interface Props {
  keywords: Keyword[];
  prefillKeyword?: string;
  initialLink?: TapLink;
  defaultNumber?: string;
  onSave: (link: TapLink) => void;
  onBack: () => void;
}

export default function CreateLinkPage({
  keywords,
  prefillKeyword,
  initialLink,
  defaultNumber,
  onSave,
  onBack,
}: Props) {
  const isEdit = Boolean(initialLink);
  const [name, setName] = useState(initialLink?.name || (prefillKeyword === "BlackFriday" ? "Black Friday" : ""));
  const [keyword, setKeyword] = useState(initialLink?.keyword || prefillKeyword || "Join");
  const number = initialLink?.number || defaultNumber || "";
  const [fallback, setFallback] = useState(initialLink?.fallbackUrl || "");
  const [active, setActive] = useState(initialLink ? initialLink.status === "Active" : true);
  const [kwOpen, setKwOpen] = useState(false);
  const [kwSearch, setKwSearch] = useState("");
  const [saveError, setSaveError] = useState("");
  const kwRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!kwOpen) return;
    const handler = (e: MouseEvent) => {
      if (kwRef.current && !kwRef.current.contains(e.target as Node)) {
        setKwOpen(false);
        setKwSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [kwOpen]);

  const filteredKeywords = keywords.filter((k) =>
    k.keyword.toLowerCase().includes(kwSearch.toLowerCase())
  );

  const handleSave = () => {
    if (!name.trim()) {
      setSaveError("Link name is required.");
      return;
    }
    if (!number.trim()) {
      setSaveError("A sending number is required. Configure a phone number in Settings before creating a link.");
      return;
    }
    setSaveError("");
    onSave({
      id: initialLink?.id || `link-${Date.now()}`,
      name,
      keyword,
      number,
      fallbackUrl: fallback,
      status: active ? "Active" : "Inactive",
      createdAt: initialLink?.createdAt || "Created just now",
      all: initialLink?.all ?? 0,
      unique: initialLink?.unique ?? 0,
      bot: initialLink?.bot ?? 0,
      url: initialLink?.url || `https://trnv.io/${Math.random().toString(36).slice(2, 7)}`,
    });
  };

  return (
    <div className="ttj-page">
      <div className="ttj-breadcrumb">Tools / Tap-to-Join Links / <span>{isEdit ? "Edit Link" : "Create Link"}</span></div>
      <div className="ttj-page-header">
        <div className="ttj-page-title-row">
          <div className="ttj-page-icon"><MousePointerClick size={20} /></div>
          <div>
            <h1>{isEdit ? "Edit Link" : "Create Link"}</h1>
            <p>{isEdit ? "Update your Tap-to-Join link." : "Create a Tap-to-Join link."}</p>
          </div>
        </div>
      </div>

      <div className="ttj-create-layout">
        <div className="ttj-form-card rounded-xl border border-border/60 bg-card shadow-sm">
          <div className="ttj-field">
            <label>Name <Info size={12} className="ttj-info-icon" /></label>
            <input className="ttj-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Black Friday" autoFocus />
          </div>

          <div className="ttj-field">
            <label>Keyword <Info size={12} className="ttj-info-icon" /></label>
            <div className="ttj-dropdown-wrap" ref={kwRef}>
              <button
                className="ttj-input ttj-dropdown-btn"
                onClick={() => setKwOpen(!kwOpen)}
                aria-expanded={kwOpen}
              >
                <span>{keyword}</span>
                <ChevronDown size={14} className={`ttj-info-icon transition-transform duration-150 ${kwOpen ? "rotate-180" : ""}`} />
              </button>
              {kwOpen && (
                <div className="ttj-dropdown">
                  <div className="ttj-dropdown-search">
                    <Search size={12} />
                    <input
                      placeholder="Search"
                      value={kwSearch}
                      onChange={(e) => setKwSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {filteredKeywords.map((k) => (
                    <button
                      key={k.id}
                      className="ttj-dropdown-item flex items-center justify-between gap-2"
                      onClick={() => { setKeyword(k.keyword); setKwOpen(false); setKwSearch(""); }}
                    >
                      <span className="truncate">{k.keyword}</span>
                      {k.keyword === keyword && <Check size={13} className="shrink-0 text-primary" />}
                    </button>
                  ))}
                  {filteredKeywords.length === 0 && (
                    <div className="ttj-dropdown-empty">No keywords found</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="ttj-field">
            <label>Number <Info size={12} className="ttj-info-icon" /></label>
            <input className="ttj-input opacity-60" value={number} disabled />
          </div>

          <div className="ttj-field">
            <label>Non-Mobile Fallback URL <Info size={12} className="ttj-info-icon" /></label>
            <input
              className="ttj-input opacity-60"
              value={fallback}
              disabled
              placeholder="Coming soon"
            />
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Fallback URLs are not saved yet. Desktop visitors will use the standard tap-to-join flow.
            </p>
          </div>

          <div className="ttj-field ttj-toggle-row">
            <label>Active</label>
            <button
              className={`ttj-toggle ${active ? "on" : ""}`}
              onClick={() => setActive(!active)}
              aria-label="Toggle active"
              aria-pressed={active}
            >
              <span className="ttj-toggle-knob" />
            </button>
          </div>

          <div className="ttj-form-actions border-t border-border/60 pt-4">
            {saveError && <p className="mb-3 text-[13px] text-red-600">{saveError}</p>}
            <button className="ttj-btn-primary" onClick={handleSave} disabled={!name.trim()}>Save</button>
            <button className="ttj-btn-ghost" onClick={onBack}>Back</button>
          </div>
        </div>

        <div className="ttj-info-card rounded-xl border border-border/60 bg-muted/20">
          <div className="ttj-info-illustration"><Smartphone size={40} /></div>
          <h3>Tap-to-Join Links</h3>
          <p>
            Instead of taking you to a webpage, tap-to-join links cause mobile devices to open their text messaging
            app and automatically fill out the necessary info to text a keyword.
          </p>
          <p>
            They&apos;re a great way to grow contact base as it takes the work out of having to compose a new text
            message. They are commonly used in social media posts and emails.
          </p>
        </div>
      </div>
    </div>
  );
}
