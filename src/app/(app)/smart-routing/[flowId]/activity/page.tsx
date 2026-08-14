"use client";

import { SmartRoutingSubNav } from "@/components/smart-routing/smart-routing-subnav";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  id: string;
  callerNumber: string;
  startedAt: string;
  menuSelection?: string | null;
  finalOutcome?: string | null;
  smsTriggered: boolean;
  isTest: boolean;
};

type TimelineEvent = {
  at: string;
  label: string;
  detail?: string;
  kind: string;
};

export default function SmartRoutingActivityPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    fetch(`/api/smart-routing/flows/${flowId}/activity`)
      .then((r) => r.json())
      .then((j) => setSessions(j.data ?? []));
  }, [flowId]);

  async function openSession(id: string) {
    setSelectedId(id);
    const res = await fetch(`/api/smart-routing/sessions/${id}`);
    const json = await res.json();
    setTimeline(json.data?.timeline ?? []);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader title="Flow Activity" description="See what happened on routed calls." />
      <SmartRoutingSubNav flowId={flowId} active="activity" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          {sessions.length === 0 ? (
            <p className="p-8 text-sm text-slate-500">No calls yet for this flow.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSession(s.id)}
                  className={cn(
                    "w-full px-5 py-4 text-left hover:bg-slate-50",
                    selectedId === s.id && "bg-indigo-50/60",
                  )}
                >
                  <p className="font-medium text-slate-900">{s.callerNumber}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.startedAt).toLocaleString()}
                    {s.isTest ? " · test" : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {s.finalOutcome?.replace(/_/g, " ") ?? "in progress"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Call timeline</h2>
          {!selectedId ? (
            <p className="mt-4 text-sm text-slate-500">Select a call to view the event timeline.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {timeline.map((ev, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 text-slate-500">
                    {new Date(ev.at).toLocaleTimeString()}
                  </span>
                  <span className="text-slate-800">{ev.label}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
