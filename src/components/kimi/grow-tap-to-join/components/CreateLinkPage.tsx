"use client";

import { useState } from "react";
import { MousePointerClick, Info, Smartphone, Search, ChevronDown } from "lucide-react";
import { Keyword, TapLink } from "../mock-data";

interface Props {
  keywords: Keyword[];
  prefillKeyword?: string;
  defaultNumber?: string;
  onSave: (link: TapLink) => void;
  onBack: () => void;
}

export default function CreateLinkPage({ keywords, prefillKeyword, defaultNumber, onSave, onBack }: Props) {
  const [name, setName] = useState(prefillKeyword === "BlackFriday" ? "Black Friday" : "");
  const [keyword, setKeyword] = useState(prefillKeyword || "Join");
  const number = defaultNumber || "888-379-4654";
  const [fallback, setFallback] = useState("");
  const [active, setActive] = useState(true);
  const [kwOpen, setKwOpen] = useState(false);
  const [kwSearch, setKwSearch] = useState("");

  const filteredKeywords = keywords.filter((k) =>
    k.keyword.toLowerCase().includes(kwSearch.toLowerCase())
  );

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: `link-${Date.now()}`,
      name,
      keyword,
      number,
      fallbackUrl: fallback,
      status: active ? "Active" : "Inactive",
      createdAt: "Created just now",
      all: 0,
      unique: 0,
      bot: 0,
      url: `https://trnv.io/${Math.random().toString(36).slice(2, 7)}`,
    });
  };

  return (
    <div className="ttj-page">
      <div className="ttj-breadcrumb">Tools / Tap-to-Join Links / <span>Create Link</span></div>
      <div className="ttj-page-header">
        <div className="ttj-page-title-row">
          <div className="ttj-page-icon"><MousePointerClick size={20} /></div>
          <div>
            <h1>Create Link</h1>
            <p>Create a Tap-to-Join link.</p>
          </div>
        </div>
      </div>

      <div className="ttj-create-layout">
        <div className="ttj-form-card">
          <div className="ttj-field">
            <label>Name <Info size={12} className="ttj-info-icon" /></label>
            <input className="ttj-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Black Friday" />
          </div>

          <div className="ttj-field">
            <label>Keyword <Info size={12} className="ttj-info-icon" /></label>
            <div className="ttj-dropdown-wrap">
              <button className="ttj-input ttj-dropdown-btn" onClick={() => setKwOpen(!kwOpen)}>
                <span>{keyword}</span>
                <ChevronDown size={14} className="ttj-info-icon" />
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
                      className="ttj-dropdown-item"
                      onClick={() => { setKeyword(k.keyword); setKwOpen(false); setKwSearch(""); }}
                    >
                      {k.keyword}
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
            <input className="ttj-input" value={number} disabled />
          </div>

          <div className="ttj-field">
            <label>Non-Mobile Fallback URL <Info size={12} className="ttj-info-icon" /></label>
            <input
              className="ttj-input"
              value={fallback}
              onChange={(e) => setFallback(e.target.value)}
              placeholder="https://stforms.co/sl/bfcm"
            />
          </div>

          <div className="ttj-field ttj-toggle-row">
            <label>Active</label>
            <button
              className={`ttj-toggle ${active ? "on" : ""}`}
              onClick={() => setActive(!active)}
              aria-label="Toggle active"
            >
              <span className="ttj-toggle-knob" />
            </button>
          </div>

          <div className="ttj-form-actions">
            <button className="ttj-btn-primary" onClick={handleSave} disabled={!name.trim()}>Save</button>
            <button className="ttj-btn-ghost" onClick={onBack}>Back</button>
          </div>
        </div>

        <div className="ttj-info-card">
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
