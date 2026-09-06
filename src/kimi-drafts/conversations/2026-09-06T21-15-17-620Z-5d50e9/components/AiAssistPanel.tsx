"use client";

import React, { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { AI_KNOWLEDGE, AI_SUGGESTIONS } from "../mock-data";

export function AiAssistPanel({
  aiActive, onUseSuggestion, onTakeover,
}: {
  aiActive?: boolean; onUseSuggestion: (text: string) => void; onTakeover: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return AI_KNOWLEDGE;
    return AI_KNOWLEDGE.filter((k) => k.toLowerCase().includes(query));
  }, [q]);

  return (
    <aside className="tv-ai" aria-label="AI Assist">
      <div className="tv-ai-head">
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--tv-primary-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={12} color="var(--tv-primary)" />
        </span>
        AI Assist
      </div>
      <div className="tv-ai-body">
        <div className="tv-ai-card">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--tv-muted)" }}>Session status</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>AI Auto-Reply</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
              background: aiActive ? "var(--tv-green-soft)" : "var(--tv-bg)", color: aiActive ? "var(--tv-green)" : "var(--tv-muted)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: aiActive ? "var(--tv-green)" : "#9ca3af" }} />
              {aiActive ? "ON" : "OFF"}
            </span>
          </div>
          {aiActive ? (
            <button type="button" className="tv-btn sm" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} onClick={onTakeover}>
              Take over conversation
            </button>
          ) : null}
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Suggested responses</p>
          {AI_SUGGESTIONS.map((s, i) => (
            <button key={i} type="button" className="tv-sugg" onClick={() => onUseSuggestion(s)}>{s}</button>
          ))}
        </div>

        <div>
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Knowledge base</p>
          <div style={{ position: "relative", marginBottom: 8 }}>
            <Search size={12} style={{ position: "absolute", left: 9, top: 9, color: "var(--tv-muted)" }} />
            <input className="tv-textinput" placeholder="Search knowledge" value={q} onChange={(e) => setQ(e.target.value)}
              aria-label="Search knowledge base" style={{ paddingLeft: 26, height: 32, fontSize: 12.5 }} />
          </div>
          {filtered.length ? filtered.map((k, i) => (
            <div key={i} className="tv-ai-card" style={{ marginBottom: 7, fontSize: 12.5, color: "var(--tv-text-2)" }}>{k}</div>
          )) : (
            <p style={{ fontSize: 12, color: "var(--tv-muted)", padding: "8px 2px" }}>No knowledge entries match "{q}".</p>
          )}
        </div>
      </div>
    </aside>
  );
}
