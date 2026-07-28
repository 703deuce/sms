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
import { automations } from "@/lib/mock/data";
import { cn, formatNumber } from "@/lib/utils";
import {
  Cake,
  Clock,
  MessageCircle,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Users,
  Wand2,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

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

  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <span className="w-8 shrink-0 text-right text-[13px] font-medium tabular-nums">
        {rate}%
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${rate}%` }}
        />
      </span>
    </div>
  );
}

export default function AutomationsPage() {
  const activeCount = automations.filter((a) => a.status === "Active").length;
  const totalEnrolled = automations.reduce((sum, a) => sum + a.enrolled, 0);
  const totalMessages = automations.reduce((sum, a) => sum + a.messagesSent, 0);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Zap}
        iconTone="bg-violet-50 text-violet-600"
        title="Automations"
        description="Build SMS flows that trigger on contact events, keywords, and time-based rules."
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
          label="Active flows"
          value={formatNumber(activeCount)}
          icon={Workflow}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[1, 1, 2, 2, 2, 2, 2, 2]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Total enrolled"
          value={formatNumber(totalEnrolled)}
          hint="Contacts currently in or completed flows"
          icon={Users}
          tone="bg-blue-50 text-blue-600"
          sparkline={[6, 8, 10, 12, 14, 16, 18, 20]}
          sparkColor="#3b82f6"
        />
        <MetricCard
          label="Messages sent"
          value={formatNumber(totalMessages)}
          hint="Across all automation flows"
          icon={MessageCircle}
          tone="bg-orange-50 text-orange-600"
          sparkline={[120, 180, 240, 320, 400, 520, 680, 840]}
          sparkColor="#f97316"
        />
      </div>

      <Card className="p-5">
        <TableToolbar title="All flows" searchPlaceholder="Search flows…">
          <Button variant="outline" size="sm" className="h-9 rounded-[10px] text-[13px]">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </TableToolbar>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
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
              const meta = flowIcons[flow.id] ?? {
                icon: Workflow,
                tone: "bg-muted text-muted-foreground",
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
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                          meta.tone,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-foreground">{flow.name}</span>
                    </Link>
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

        <PaginationBar rangeLabel="1–4 of 4" />
      </Card>
    </div>
  );
}
