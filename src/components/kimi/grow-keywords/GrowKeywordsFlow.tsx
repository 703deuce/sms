/**
 * Kimi session 2026-08-31T00-27-03-081Z-938e13 — UI from Kimi draft (mock data, no backend wiring yet).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import KeywordsList from "./components/KeywordsList";
import KeywordBuilder from "./components/KeywordBuilder";
import { CheckCircle2 } from "lucide-react";

export default function GrowKeywordsFlow() {
  const [view, setView] = useState<"list" | "create">("list");
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleSaved = () => {
    setView("list");
    setToast(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 3200);
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
        <div
          role="status"
          className="kw-toast fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] font-medium text-foreground shadow-lg"
        >
          <CheckCircle2 size={16} className="text-emerald-500" />
          Keyword created.
        </div>
      )}
    </div>
  );
}
