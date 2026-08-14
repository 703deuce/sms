"use client";

import { SmartRoutingSubNav } from "@/components/smart-routing/smart-routing-subnav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { GitBranch, PhoneForwarded, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type FlowRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  todayCalls?: number;
  assignedPhoneNumberId?: string | null;
};

type Metrics = {
  activeFlows: number;
  routedToday: number;
  recovered: number;
  failures: number;
};

const STATUS_CLASS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  testing: "bg-amber-50 text-amber-800 ring-amber-200",
  paused: "bg-slate-100 text-slate-600 ring-slate-200",
  needs_attention: "bg-red-50 text-red-700 ring-red-200",
};

export default function SmartRoutingOverviewPage() {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/smart-routing/flows")
      .then((r) => r.json())
      .then((j) => {
        setFlows(j.data ?? []);
        setMetrics(j.metrics ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Smart Routing"
        description="Greet callers, route calls, manage after-hours calls, and connect customers to the right person automatically."
        actions={
          <Link href="/smart-routing/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Call Flow
            </Button>
          </Link>
        }
      />

      <SmartRoutingSubNav active="flows" />

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Flows", value: metrics.activeFlows, icon: GitBranch },
            { label: "Calls Routed Today", value: metrics.routedToday, icon: PhoneForwarded },
            { label: "Missed Calls Recovered", value: metrics.recovered, icon: RefreshCw },
            { label: "Routing Failures", value: metrics.failures, icon: PhoneForwarded },
          ].map((m) => (
            <Card key={m.label} className="p-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <m.icon className="h-4 w-4 text-indigo-500" />
                {m.label}
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{m.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-8 text-sm text-slate-500">Loading flows…</p>
        ) : flows.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-lg font-semibold text-slate-900">Make your business line smarter</h3>
            <p className="mt-2 text-sm text-slate-600">
              Add a greeting, route callers to the right person, handle after-hours calls, or recover
              missed calls automatically.
            </p>
            <Link href="/smart-routing/new" className="mt-6 inline-block">
              <Button className="bg-indigo-600 hover:bg-indigo-700">Create Your First Call Flow</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {flows.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/80"
              >
                <div>
                  <Link
                    href={`/smart-routing/${f.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {f.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {f.type.replace(/_/g, " ")} · {f.todayCalls ?? 0} today
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                    STATUS_CLASS[f.status] ?? STATUS_CLASS.draft,
                  )}
                >
                  {f.status.replace(/_/g, " ")}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/smart-routing/${f.id}`}>
                    <Button variant="outline" size="sm">Edit</Button>
                  </Link>
                  <Link href={`/smart-routing/${f.id}/test`}>
                    <Button variant="outline" size="sm">Test</Button>
                  </Link>
                  <Link href={`/smart-routing/${f.id}/activity`}>
                    <Button variant="outline" size="sm">Activity</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
