"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type AgentRow = {
  id: string;
  name: string;
  status: string;
  callsHandled: number;
  healthStatus: string;
  updatedAt: string;
};

export default function VoiceAgentsPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);

  useEffect(() => {
    fetch("/api/voice/agents")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">My Agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, test, and manage your AI receptionist.
          </p>
        </div>
        <Link href="/voice/agents/new">
          <Button className="gap-2 bg-primary hover:bg-primary-hover">
            <Plus className="h-4 w-4" />
            Create New Agent
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="voice-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-6 text-lg font-semibold">No receptionist yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Set up Amy in three quick steps — about your business, what she should do, and voice
            &amp; test.
          </p>
          <Link href="/voice/agents/new" className="mt-6 voice-btn-primary">
            Create New Agent
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((a) => (
            <Link
              key={a.id}
              href={`/voice/agents/${a.id}/about`}
              className="voice-card block p-6 transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                    {a.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.callsHandled} calls handled
                    </p>
                  </div>
                </div>
                <StatusChip status={a.status} />
              </div>
              <p className="mt-4 text-sm text-primary font-medium">Open agent →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
