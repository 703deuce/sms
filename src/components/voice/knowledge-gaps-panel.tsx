"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Gap = {
  id: string;
  displayQuestion: string;
  status: string;
  timesAsked: number;
  lastAskedAt: string;
  recentWording: string | null;
  sourceCallIds: string[];
};

type KbRow = { id: string; name: string };

export function KnowledgeGapsPanel({
  defaultKnowledgeBaseId,
  onResolved,
}: {
  defaultKnowledgeBaseId?: string;
  onResolved?: () => void;
} = {}) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [kbs, setKbs] = useState<KbRow[]>([]);
  const [filter, setFilter] = useState<"OPEN" | "all">("OPEN");
  const [loading, setLoading] = useState(true);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [kbId, setKbId] = useState(defaultKnowledgeBaseId || "");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "OPEN" ? "?status=OPEN" : "";
      const [gRes, kRes] = await Promise.all([
        fetch(`/api/voice/knowledge-gaps${q}`, { cache: "no-store" }),
        fetch("/api/voice/knowledge"),
      ]);
      const gJson = await gRes.json();
      const kJson = await kRes.json();
      setGaps(gJson.data || []);
      const kbRows = (kJson.data || []) as KbRow[];
      setKbs(kbRows);
      if (!kbId && defaultKnowledgeBaseId) setKbId(defaultKnowledgeBaseId);
      else if (!kbId && kbRows[0]?.id) setKbId(kbRows[0].id);
    } finally {
      setLoading(false);
    }
  }, [filter, kbId, defaultKnowledgeBaseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchGap(id: string, status: "DISMISSED" | "RESOLVED", extra?: { answerText?: string }) {
    setResolveError("");
    if (status === "RESOLVED" && extra?.answerText) {
      setResolving(true);
    }
    try {
      const res = await fetch("/api/voice/knowledge-gaps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          knowledgeBaseId: kbId || undefined,
          answerText: extra?.answerText,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResolveError(
          json.error ||
            "Answer could not be prepared for search. The question stays open — try again or reindex.",
        );
        return;
      }
      setResolveId(null);
      setAnswerText("");
      onResolved?.();
      await load();
    } finally {
      setResolving(false);
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Unanswered questions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions callers asked that Amy could not answer from approved knowledge. Review and add
            answers you approve — we never auto-learn from callers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "OPEN" ? "primary" : "outline"}
            onClick={() => setFilter("OPEN")}
          >
            Open
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "primary" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : gaps.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No knowledge gaps in this view.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {gaps.map((g) => (
            <li key={g.id} className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground">{g.displayQuestion}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Asked {g.timesAsked}× · Last {new Date(g.lastAskedAt).toLocaleString()} ·{" "}
                {g.status}
              </p>
              {g.recentWording ? (
                <p className="mt-2 text-sm text-muted-foreground">{g.recentWording}</p>
              ) : null}
              {g.sourceCallIds.length ? (
                <p className="mt-2 text-xs">
                  Calls:{" "}
                  {g.sourceCallIds.slice(-3).map((cid) => (
                    <Link
                      key={cid}
                      href={`/voice/calls/${cid}`}
                      className="mr-2 text-primary underline"
                    >
                      View
                    </Link>
                  ))}
                </p>
              ) : null}
              {g.status === "OPEN" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => patchGap(g.id, "DISMISSED")}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => setResolveId(g.id)}>
                    Add answer
                  </Button>
                </div>
              ) : null}
              {resolveId === g.id ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <div>
                    <Label htmlFor={`kb-${g.id}`}>Knowledge base</Label>
                    <select
                      id={`kb-${g.id}`}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                      value={kbId}
                      onChange={(e) => setKbId(e.target.value)}
                    >
                      {kbs.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`ans-${g.id}`}>Approved answer</Label>
                    <Input
                      id={`ans-${g.id}`}
                      className="mt-1"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Write the answer customers should hear…"
                    />
                  </div>
                  <div className="flex gap-2">
                    {resolveError ? (
                      <p className="text-sm text-danger" role="alert">{resolveError}</p>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={!answerText.trim() || !kbId || resolving}
                      onClick={() => patchGap(g.id, "RESOLVED", { answerText })}
                    >
                      {resolving ? "Processing answer…" : "Save & make searchable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setResolveId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
