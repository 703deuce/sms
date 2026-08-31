/**
 * Backend adapter shell for Kimi grow-keywords.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import KeywordsList from "@/components/kimi/grow-keywords/components/KeywordsList";
import KeywordBuilder from "@/components/kimi/grow-keywords/components/KeywordBuilder";
import type { Keyword } from "@/components/kimi/grow-keywords/mock-data";
import { createKeyword, deleteKeyword, fetchContactListNames, fetchKeywords } from "@/lib/growth/kimi-keywords-adapter";
import { CheckCircle2 } from "lucide-react";

type Props = { initialKeywords?: Keyword[] };

export function KimiKeywordsConnected({ initialKeywords = [] }: Props) {
  const [view, setView] = useState<"list" | "create">("list");
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords);
  const [contactLists, setContactLists] = useState<string[]>([]);
  const [toast, setToast] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [rows, lists] = await Promise.all([fetchKeywords(), fetchContactListNames()]);
    setKeywords(rows);
    setContactLists(lists);
  }, []);

  useEffect(() => {
    if (initialKeywords.length === 0) {
      void reload().catch((err) => setError(err instanceof Error ? err.message : "Load failed"));
    } else {
      void fetchContactListNames().then(setContactLists).catch(() => undefined);
    }
  }, [initialKeywords.length, reload]);

  const handleSaved = async (payload: { keyword: string; listName?: string; confirmation?: string }) => {
    try {
      await createKeyword(payload);
      await reload();
      setView("list");
      setToast(true);
      setTimeout(() => setToast(false), 3200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKeyword(id);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="kw-shell">
      <main className="kw-main">
        {error && <p className="px-6 pt-4 text-sm text-red-600">{error}</p>}
        {view === "list" ? (
          <KeywordsList
            keywords={keywords}
            onCreate={() => setView("create")}
            onDelete={(id) => void handleDelete(id)}
          />
        ) : (
          <KeywordBuilder
            contactLists={contactLists}
            onBack={() => setView("list")}
            onSaved={() => setView("list")}
            onSaveKeyword={handleSaved}
          />
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
