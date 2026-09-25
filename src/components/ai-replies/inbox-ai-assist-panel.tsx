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
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-2.5 text-[13px] font-medium text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </span>
        <span>
          AI Agent is handling this conversation
          {session.aiReplyName ? (
            <span className="font-normal text-muted-foreground"> · {session.aiReplyName}</span>
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
  hideAutomationOwnership = false,
}: {
  conversationId?: string;
  onUseSuggestion: (text: string) => void;
  assist?: ReturnType<typeof useInboxAiAssist>;
  /** MCTB threads use mctbConversationAutomationState — hide generic AI Assist takeover. */
  hideAutomationOwnership?: boolean;
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
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-border bg-muted/30 xl:flex">
      <div className="flex items-center gap-2 border-b border-border bg-card/60 px-4 py-3">
        <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="h-3 w-3 text-primary" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">AI Assist</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-muted" />
            <div className="h-20 animate-pulse rounded-xl bg-muted" />
            <div className="h-20 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : (
          <>
            {session && !hideAutomationOwnership ? (
              <div className="mb-4 rounded-xl border border-border bg-card p-3.5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Session status
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-foreground">AI Auto-Reply</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      session.status === "ai_active"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        session.status === "ai_active" ? "bg-emerald-500" : "bg-slate-400",
                      )}
                    />
                    {session.status === "ai_active" ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            ) : null}

            {suggestions.length ? (
              <div className="mb-4">
                <p className="mb-2 text-[12px] font-semibold text-foreground">Suggested responses</p>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onUseSuggestion(s)}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[12px] leading-relaxed text-foreground/80 shadow-sm transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {knowledge.length ? (
              <div>
                <p className="mb-2 text-[12px] font-semibold text-foreground">Knowledge search</p>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={knowledgeQuery}
                    onChange={(e) => setKnowledgeQuery(e.target.value)}
                    placeholder="Search knowledge…"
                    className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[12px] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <ul className="space-y-1.5">
                  {filteredKnowledge.length ? (
                    filteredKnowledge.map((k, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-border/70 bg-card px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground"
                      >
                        {k}
                      </li>
                    ))
                  ) : (
                    <li className="px-1 text-[12px] text-muted-foreground/70">No matching knowledge</li>
                  )}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>

      {session?.status === "ai_active" && !hideAutomationOwnership ? (
        <div className="border-t border-border bg-card/60 p-4">
          <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => void takeover()}>
            Take Over Conversation
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
