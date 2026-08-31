"use client";

import { useState } from "react";
import KeywordsList from "./components/KeywordsList";
import KeywordBuilder from "./components/KeywordBuilder";
import { CheckCircle2 } from "lucide-react";
/**
 * Kimi session 2026-08-31T00-27-03-081Z-938e13 — UI from Kimi draft (mock data, no backend wiring yet).
 */
export default function GrowKeywordsFlow() {
  const [view, setView] = useState<"list" | "create">("list");
  const [toast, setToast] = useState(false);

  const handleSaved = () => {
    setView("list");
    setToast(true);
    setTimeout(() => setToast(false), 3200);
  };

  return (
    <div className="kw-shell">
      <main className="kw-main">
        {view === "list" ? (
          <KeywordsList onCreate={() => setView("create")} />
        ) : (
          <KeywordBuilder onBack={() => setView("list")} onSaved={handleSaved} />
        )}
      </main>
      {toast && (
        <div className="kw-toast">
          <CheckCircle2 size={16} /> Keyword created.
        </div>
      )}
    </div>
  );
}
