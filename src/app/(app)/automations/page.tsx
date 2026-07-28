"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { automationTabs } from "@/lib/automation-tabs";
import { automations } from "@/lib/mock/data";
import { cn, formatNumber } from "@/lib/utils";
import {
  Cake,
  Clock,
  LayoutGrid,
  LayoutList,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  SlidersHorizontal,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const flowMeta: Record<
  string,
  { icon: LucideIcon; tone: string; steps: number }
> = {
  auto_1: { icon: Zap, tone: "bg-emerald-50 text-emerald-600", steps: 3 },
  auto_2: { icon: MessageCircle, tone: "bg-sky-50 text-sky-600", steps: 2 },
  auto_3: { icon: Clock, tone: "bg-orange-50 text-orange-600", steps: 2 },
  auto_4: { icon: Cake, tone: "bg-violet-50 text-violet-600", steps: 1 },
};

function formatUpdated(at: string) {
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CompletionCell({ status, rate }: { status: string; rate: number }) {
  if (status === "Draft") {
    return <span className="text-muted-foreground">—</span>;
  }

  const barColor = rate < 50 ? "bg-orange-500" : "bg-primary";

  return (
    <div className="flex min-w-[130px] items-center gap-2">
      <span className="w-11 shrink-0 text-right text-[13px] font-semibold tabular-nums">
        {rate.toFixed(1)}%
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", barColor)}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </span>
    </div>
  );
}

export default function AutomationsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const activeCount = automations.filter((a) => a.status === "Active").length;
  const totalEnrolled = automations.reduce((sum, a) => sum + a.enrolled, 0);
  const totalMessages = automations.reduce((sum, a) => sum + a.messagesSent, 0);

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={Zap}
        iconTone="bg-emerald-50 text-emerald-600"
        title="Automations"
        description="Build SMS flows that trigger on contact events, keywords, and time-based rules."
        actions={
          <Link href="/automations/new">
            <Button className="rounded-[10px]">
              <Plus className="h-4 w-4" />
              New flow
            </Button>
          </Link>
        }
      />

      <Tabs items={automationTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Active flows"
          value={formatNumber(activeCount)}
          hint="— 0% vs last 7 days"
          icon={Workflow}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[1, 1, 2, 2, 2, 2, 2, 2]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Total enrolled"
          value={formatNumber(totalEnrolled)}
          hint="↑ 18% vs last 7 days"
          icon={Users}
          tone="bg-sky-50 text-sky-600"
          sparkline={[6, 8, 10, 12, 14, 16, 18, 20]}
          sparkColor="#3b82f6"
        />
        <MetricCard
          label="Messages sent"
          value={formatNumber(totalMessages)}
          hint="↑ 24% vs last 7 days"
          icon={Send}
          tone="bg-violet-50 text-violet-600"
          sparkline={[120, 180, 240, 320, 400, 520, 680, 840]}
          sparkColor="#8b5cf6"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[14px] font-bold text-foreground">All flows</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="h-9 w-full min-w-[180px] rounded-[10px] border border-border bg-card px-3 text-[13px] outline-none focus:border-primary sm:w-52"
              placeholder="Search flows..."
            />
            <Button variant="outline" size="sm" className="rounded-[10px]">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </Button>
            <div className="flex items-center rounded-[10px] border border-border p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="List view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[8px] transition",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[920px] text-[13px]">
              <THead>
                <TR>
                  <TH>Flow</TH>
                  <TH>Trigger</TH>
                  <TH>Enrolled</TH>
                  <TH>Messages sent</TH>
                  <TH>Completion rate</TH>
                  <TH>Status</TH>
                  <TH>Updated</TH>
                  <TH className="w-10" />
                </TR>
              </THead>
              <TBody>
                {automations.map((flow) => {
                  const meta = flowMeta[flow.id] ?? {
                    icon: Workflow,
                    tone: "bg-muted text-muted-foreground",
                    steps: 1,
                  };
                  const Icon = meta.icon;

                  return (
                    <TR key={flow.id}>
                      <TD>
                        <Link
                          href={`/automations/${flow.id}`}
                          className="flex items-center gap-3 hover:opacity-80"
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              meta.tone,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-semibold text-foreground">
                              {flow.name}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {meta.steps} step{meta.steps === 1 ? "" : "s"}
                            </span>
                          </span>
                        </Link>
                      </TD>
                      <TD className="max-w-[220px] text-muted-foreground">{flow.trigger}</TD>
                      <TD className="tabular-nums font-medium">
                        {formatNumber(flow.enrolled)}
                      </TD>
                      <TD className="tabular-nums font-medium">
                        {formatNumber(flow.messagesSent)}
                      </TD>
                      <TD>
                        <CompletionCell status={flow.status} rate={flow.completionRate} />
                      </TD>
                      <TD>
                        <StatusChip status={flow.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {formatUpdated(flow.updatedAt)}
                      </TD>
                      <TD>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                          aria-label={`Actions for ${flow.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {automations.map((flow) => {
              const meta = flowMeta[flow.id] ?? {
                icon: Workflow,
                tone: "bg-muted text-muted-foreground",
                steps: 1,
              };
              const Icon = meta.icon;
              return (
                <Link
                  key={flow.id}
                  href={`/automations/${flow.id}`}
                  className="rounded-[12px] border border-border p-4 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        meta.tone,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{flow.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {meta.steps} step{meta.steps === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">{flow.trigger}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <StatusChip status={flow.status} />
                        <span className="text-[12px] tabular-nums text-muted-foreground">
                          {formatNumber(flow.enrolled)} enrolled
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <PaginationBar rangeLabel="1–4 of 4" />
      </Card>
    </div>
  );
}
