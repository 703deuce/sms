/**
 * Backend adapter shell for Kimi grow-keywords.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import KeywordsList from "@/components/kimi/grow-keywords/components/KeywordsList";
import KeywordBuilder from "@/components/kimi/grow-keywords/components/KeywordBuilder";
import type { Keyword } from "@/components/kimi/grow-keywords/mock-data";
import { createKeyword, deleteKeyword, fetchContactListNames, fetchKeywords, cloneKeyword, updateKeyword } from "@/lib/growth/kimi-keywords-adapter";
import { CheckCircle2, Loader2 } from "lucide-react";

type View = "list" | "create" | "edit";

type Props = { initialKeywords?: Keyword[] };

export function KimiKeywordsConnected({ initialKeywords = [] }: Props) {
  const [view, setView] = useState<View>("list");
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [contactLists, setContactLists] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialKeywords.length === 0);

  const reload = useCallback(async () => {
    const [rows, lists] = await Promise.all([fetchKeywords(), fetchContactListNames()]);
    setKeywords(rows);
    setContactLists(lists);
    return rows;
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload()
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [reload]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const handleSaved = async (payload: {
    keywordId?: string;
    keyword: string;
    listName?: string;
    confirmation?: string;
    autoReply?: string;
    status?: string;
  }) => {
    try {
      if (payload.keywordId) {
        await updateKeyword(payload.keywordId, payload);
        showToast("Keyword updated.");
      } else {
        await createKeyword({
          ...payload,
          listName: payload.listName ?? null,
        });
        showToast("Keyword created.");
      }
      await reload();
      setEditingKeyword(null);
      setView("list");
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

  const handleClone = async (id: string) => {
    try {
      await cloneKeyword(id, keywords);
      await reload();
      showToast("Keyword cloned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed");
    }
  };

  return (
    <div className="kw-shell">
      <main className="kw-main">
        {error && <p className="px-6 pt-4 text-sm text-red-600">{error}</p>}
        {view === "list" ? (
          loading && keywords.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading keywords…
            </div>
          ) : (
          <KeywordsList
            keywords={keywords}
            onCreate={() => {
              setEditingKeyword(null);
              setView("create");
            }}
            onDelete={(id) => void handleDelete(id)}
            onClone={(id) => void handleClone(id)}
            onEdit={(id) => {
              const kw = keywords.find((k) => k.id === id);
              if (!kw) return;
              setEditingKeyword(kw);
              setView("edit");
            }}
            onCreateQr={(id) => {
              const kw = keywords.find((k) => k.id === id);
              window.location.assign(kw ? `/grow/qr-codes?keyword=${encodeURIComponent(kw.name)}` : "/grow/qr-codes");
            }}
            onCreateTap={(id) => {
              const kw = keywords.find((k) => k.id === id);
              window.location.assign(kw ? `/grow/tap-to-join?keyword=${encodeURIComponent(kw.name)}` : "/grow/tap-to-join");
            }}
          />
          )
        ) : (
          <KeywordBuilder
            key={editingKeyword?.id ?? "create"}
            editingKeyword={editingKeyword}
            contactLists={contactLists}
            onBack={() => {
              setEditingKeyword(null);
              setView("list");
            }}
            onSaved={() => setView("list")}
            onSaveKeyword={handleSaved}
          />
        )}
      </main>
      {toast && (
        <div className="kw-toast">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
