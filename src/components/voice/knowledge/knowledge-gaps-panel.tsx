"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useEffect, useState } from "react";

type Gap = {
  id: string;
  displayQuestion: string;
  timesAsked: number;
  lastAskedAt: string;
  recentWording?: string | null;
  sourceCallIds?: unknown;
};

export function KnowledgeGapsPanel() {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [answerFor, setAnswerFor] = useState<Gap | null>(null);
  const [answer, setAnswer] = useState("");
  const [kbId, setKbId] = useState("");

  async function loadGaps() {
    const res = await fetch("/api/voice/knowledge-gaps");
    const json = await res.json();
    setGaps(json.data || []);
  }

  useEffect(() => {
    loadGaps();
    fetch("/api/voice/knowledge")
      .then((r) => r.json())
      .then((j) => {
        const first = (j.data || [])[0];
        if (first?.id) setKbId(first.id);
      });
  }, []);

  async function ignore(id: string) {
    await fetch("/api/voice/knowledge-gaps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "IGNORED" }),
    });
    await loadGaps();
  }

  async function saveAnswer() {
    if (!answerFor || !kbId) return;
    await fetch(`/api/voice/knowledge/${kbId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceType: "text",
        name: answerFor.displayQuestion.slice(0, 80),
        contentText: `Q: ${answerFor.displayQuestion}\n\nA: ${answer}`,
      }),
    });
    await fetch("/api/voice/knowledge-gaps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: answerFor.id, status: "ANSWERED" }),
    });
    setAnswerFor(null);
    setAnswer("");
    await loadGaps();
  }

  return (
    <Card>
      <CardTitle className="mb-1">Unanswered questions</CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Help Amy answer questions callers are asking after hours.
      </p>
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open knowledge gaps.</p>
      ) : (
        <ul className="divide-y divide-border">
          {gaps.map((gap) => (
            <li key={gap.id} className="py-4">
              <p className="font-medium text-sm">{gap.displayQuestion}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Asked {gap.timesAsked} times · Last asked{" "}
                {new Date(gap.lastAskedAt).toLocaleDateString()}
              </p>
              {gap.recentWording ? (
                <p className="mt-2 text-xs italic text-muted-foreground">
                  Recent caller wording: &ldquo;{gap.recentWording}&rdquo;
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => setAnswerFor(gap)}>
                  Add answer
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => ignore(gap.id)}>
                  Ignore
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {answerFor ? (
        <div className="mt-6 rounded-lg border border-border p-4">
          <Label>Question</Label>
          <p className="text-sm font-medium">{answerFor.displayQuestion}</p>
          <Label className="mt-3 block">Answer</Label>
          <textarea
            className="mt-1 min-h-[100px] w-full rounded-md border border-border p-2 text-sm"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={saveAnswer} disabled={!answer.trim()}>
              Save to knowledge
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAnswerFor(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
