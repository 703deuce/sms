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
  durationSeconds?: number;
  smsTriggered: boolean;
  isTest: boolean;
};

export default function SmartRoutingActivityPage() {
  const params = useParams();
  const flowId = String(params.flowId);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetch(`/api/smart-routing/flows/${flowId}/activity`)
      .then((r) => r.json())
      .then((j) => setSessions(j.data ?? []));
  }, [flowId]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader title="Flow Activity" description="See what happened on routed calls." />
      <SmartRoutingSubNav flowId={flowId} active="activity" />
      <Card className="overflow-hidden">
        {sessions.length === 0 ? (
          <p className="p-8 text-sm text-slate-500">No calls yet for this flow.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <div key={s.id} className="grid gap-2 px-5 py-4 sm:grid-cols-5 sm:items-center">
                <div>
                  <p className="font-medium text-slate-900">{s.callerNumber}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(s.startedAt).toLocaleString()}
                    {s.isTest ? " · test" : ""}
                  </p>
                </div>
                <p className="text-sm text-slate-600">
                  Menu: {s.menuSelection ?? "—"}
                </p>
                <p className="text-sm text-slate-600">
                  SMS: {s.smsTriggered ? "Yes" : "No"}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    s.finalOutcome === "connected"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {s.finalOutcome?.replace(/_/g, " ") ?? "in progress"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
