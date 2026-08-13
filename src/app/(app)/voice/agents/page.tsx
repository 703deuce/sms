"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Phone, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type AgentRow = {
  id: string;
  name: string;
  status: string;
  callsHandled: number;
  healthStatus: string;
  updatedAt: string;
  phoneNumberId: string | null;
  phoneE164: string | null;
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
          <h1 className="font-display text-2xl font-semibold tracking-tight">My Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, test, and manage your AI receptionists — each with its own phone number.
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
            Set up your AI receptionist in three quick steps — about your business, capabilities,
            and voice &amp; test.
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
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {a.phoneE164 ? (
                  <span className="font-medium text-foreground">{a.phoneE164}</span>
                ) : (
                  <span className="text-muted-foreground">No number assigned</span>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-primary">Open agent →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
