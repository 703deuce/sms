"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
  TableToolbar,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import type { AutomationFlow } from "@/lib/types";
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
  Users,
  Wand2,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

const flowIcons: Record<string, { icon: LucideIcon; tone: string }> = {
  auto_1: { icon: Wand2, tone: "bg-emerald-50 text-emerald-600" },
  auto_2: { icon: MessageCircle, tone: "bg-blue-50 text-blue-600" },
  auto_3: { icon: Clock, tone: "bg-orange-50 text-orange-600" },
  auto_4: { icon: Cake, tone: "bg-violet-50 text-violet-600" },
};

function formatUpdated(at: string) {
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CompletionCell({
  status,
  rate,
}: {
  status: string;
  rate: number;
}) {
  if (status === "Draft") {
    return <span className="text-muted-foreground">—</span>;
  }

  const barColor = rate < 50 ? "bg-orange-500" : "bg-primary";

  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <span className="w-10 shrink-0 text-right text-[13px] font-medium tabular-nums">
        {rate.toFixed(1)}%
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", barColor)}
          style={{ width: `${rate}%` }}
        />
      </span>
    </div>
  );
}

export default function AutomationsPage() {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [automations, setAutomations] = useState<AutomationFlow[]>([]);
  const [ownershipFilter, setOwnershipFilter] = useState<
    "all" | "agent_workflow" | "standalone"
  >("all");

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setAutomations(json.data);
      })
      .catch(() => undefined);
  }, []);

  const filtered = automations.filter((a) => {
    if (ownershipFilter === "all") return true;
    const kind =
      a.ownershipKind ||
      (a.createdFrom === "Agent workflow" ? "agent_workflow" : "standalone");
    return kind === ownershipFilter;
  });

  const activeCount = filtered.filter((a) => a.status === "Active").length;
  const totalEnrolled = filtered.reduce((sum, a) => sum + a.enrolled, 0);
  const totalMessages = filtered.reduce((sum, a) => sum + a.messagesSent, 0);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Zap}
        iconTone="bg-emerald-50 text-emerald-600"
        title="Automations"
        description="Agent workflows and standalone automations. Wizard-created agents open here via Edit Workflow."
        actions={
          <Link href="/automations/new">
            <Button className="h-9 rounded-[10px] text-[13px]">
              <Plus className="h-4 w-4" />
              New flow
            </Button>
          </Link>
        }
      />

      <Tabs items={automationTabs} />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Active Flows"
          value={formatNumber(activeCount)}
          icon={Workflow}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[1, 1, 2, 2, 2, 2, 2, 2]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Total Enrolled"
          value={formatNumber(totalEnrolled)}
          icon={Users}
          tone="bg-blue-50 text-blue-600"
          sparkline={[6, 8, 10, 12, 14, 16, 18, 20]}
          sparkColor="#3b82f6"
        />
        <MetricCard
          label="Messages Sent"
          value={formatNumber(totalMessages)}
          icon={Send}
          tone="bg-violet-50 text-violet-600"
          sparkline={[120, 180, 240, 320, 400, 520, 680, 840]}
          sparkColor="#8b5cf6"
        />
      </div>

      <Card className="p-5">
        <TableToolbar title="All flows" searchPlaceholder="Search flows…">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", "All"],
                ["agent_workflow", "Agent Workflows"],
                ["standalone", "Standalone"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOwnershipFilter(id)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold",
                  ownershipFilter === id
                    ? "bg-[#111827] text-white"
                    : "bg-white text-[#4B5563] ring-1 ring-[#E5E7EB]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
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
        </TableToolbar>

        {viewMode === "list" ? (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Created From</TH>
                <TH>Owned by</TH>
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
              {filtered.map((flow) => {
                const meta = flowIcons[flow.id] ?? {
                  icon: Workflow,
                  tone: "bg-muted text-muted-foreground",
                };
                const Icon = meta.icon;

                return (
                  <TR key={flow.id}>
                    <TD>
                      <Link
                        href={`/automations/${flow.id}/edit`}
                        className="flex items-center gap-3 hover:opacity-80"
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                            meta.tone,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-semibold text-foreground">{flow.name}</span>
                      </Link>
                    </TD>
                    <TD className="max-w-[160px] text-[13px] text-muted-foreground">
                      {flow.createdFrom || "Standalone automation"}
                    </TD>
                    <TD className="max-w-[180px] text-[13px] text-muted-foreground">
                      {flow.ownedBy || "—"}
                    </TD>
                    <TD className="max-w-[200px] text-[13px] text-muted-foreground">
                      {flow.trigger}
                    </TD>
                    <TD className="tabular-nums">{formatNumber(flow.enrolled)}</TD>
                    <TD className="tabular-nums">{formatNumber(flow.messagesSent)}</TD>
                    <TD>
                      <CompletionCell status={flow.status} rate={flow.completionRate} />
                    </TD>
                    <TD>
                      <StatusChip status={flow.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-[13px] text-muted-foreground">
                      {formatUpdated(flow.updatedAt)}
                    </TD>
                    <TD>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((flow) => {
              const meta = flowIcons[flow.id] ?? {
                icon: Workflow,
                tone: "bg-muted text-muted-foreground",
              };
              const Icon = meta.icon;
              return (
                <Link
                  key={flow.id}
                  href={`/automations/${flow.id}/edit`}
                  className="rounded-[12px] border border-border p-4 transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                        meta.tone,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{flow.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {flow.createdFrom}
                        {flow.ownedBy ? ` · ${flow.ownedBy}` : ""}
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

        <PaginationBar
          rangeLabel={
            filtered.length
              ? `1–${filtered.length} of ${filtered.length}`
              : "0 of 0"
          }
        />
      </Card>
    </div>
  );
}
