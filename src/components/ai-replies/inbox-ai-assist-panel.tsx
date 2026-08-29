"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AiSession = {
  status: string;
  aiReplyName?: string;
};

type AiAssistData = {
  session: AiSession | null;
  suggestions: string[];
  knowledge: string[];
};

export function useInboxAiAssist(conversationId?: string) {
  const [data, setData] = useState<AiAssistData>({
    session: null,
    suggestions: [],
    knowledge: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setData({ session: null, suggestions: [], knowledge: [] });
      return;
    }
    setLoading(true);
    fetch(`/api/inbox/${conversationId}/ai-assist`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data) {
          setData({ session: null, suggestions: [], knowledge: [] });
          return;
        }
        setData({
          session: json.data.session,
          suggestions: json.data.suggestions || [],
          knowledge: json.data.knowledge || [],
        });
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  async function takeover() {
    if (!conversationId) return;
    await fetch(`/api/inbox/${conversationId}/ai-assist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "takeover" }),
    });
    setData((prev) => ({
      ...prev,
      session: prev.session ? { ...prev.session, status: "human" } : prev.session,
    }));
  }

  return { ...data, loading, takeover };
}

export function InboxAiBanner({
  session,
  onTakeover,
}: {
  session: AiSession | null;
  onTakeover: () => void;
}) {
  if (!session || session.status !== "ai_active") return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span>
          AI Agent is currently handling this conversation
          {session.aiReplyName ? (
            <span className="font-normal text-slate-600"> · {session.aiReplyName}</span>
          ) : null}
        </span>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onTakeover}>
        Take Over
      </Button>
    </div>
  );
}

export function InboxAiAssistPanel({
  conversationId,
  onUseSuggestion,
  assist,
}: {
  conversationId?: string;
  onUseSuggestion: (text: string) => void;
  assist?: ReturnType<typeof useInboxAiAssist>;
}) {
  const internal = useInboxAiAssist(assist ? undefined : conversationId);
  const { session, suggestions, knowledge, loading, takeover } = assist ?? internal;
  const [knowledgeQuery, setKnowledgeQuery] = useState("");

  const filteredKnowledge = useMemo(() => {
    const q = knowledgeQuery.trim().toLowerCase();
    if (!q) return knowledge;
    return knowledge.filter((k) => k.toLowerCase().includes(q));
  }, [knowledge, knowledgeQuery]);

  if (!conversationId) return null;

  const hasContent = session || suggestions.length > 0 || knowledge.length > 0;
  if (!loading && !hasContent) return null;

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-slate-200 bg-slate-50 xl:flex">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">AI Assist</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-[12px] text-slate-500">Loading AI assist…</p>
        ) : (
          <>
            {session ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Session status
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-slate-800">AI Auto-Reply</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      session.status === "ai_active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {session.status === "ai_active" ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            ) : null}

            {suggestions.length ? (
              <div className="mb-4">
                <p className="mb-2 text-[12px] font-semibold text-slate-700">Suggested responses</p>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onUseSuggestion(s)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[12px] leading-relaxed text-slate-700 hover:border-primary hover:bg-primary/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {knowledge.length ? (
              <div>
                <p className="mb-2 text-[12px] font-semibold text-slate-700">Knowledge search</p>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={knowledgeQuery}
                    onChange={(e) => setKnowledgeQuery(e.target.value)}
                    placeholder="Search knowledge…"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12px] outline-none focus:border-primary"
                  />
                </div>
                <ul className="space-y-1.5">
                  {filteredKnowledge.length ? (
                    filteredKnowledge.map((k, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-[12px] text-slate-600"
                      >
                        {k}
                      </li>
                    ))
                  ) : (
                    <li className="text-[12px] text-slate-400">No matching knowledge</li>
                  )}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>

      {session?.status === "ai_active" ? (
        <div className="border-t border-slate-200 p-4">
          <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => void takeover()}>
            Take Over Conversation
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
