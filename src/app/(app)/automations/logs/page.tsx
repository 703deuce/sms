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
import { cn, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowDown,
  UserPlus,
  Zap,
} from "lucide-react";

const automationLogs = [
  {
    id: "al_1",
    contact: "Maya Chen",
    flow: "Welcome series",
    event: "Enrollment",
    step: "Trigger: Contact joins list",
    status: "Complete",
    at: "2026-07-27T14:22:00Z",
  },
  {
    id: "al_2",
    contact: "Maya Chen",
    flow: "Welcome series",
    event: "Action",
    step: "Send SMS: Welcome message",
    status: "Delivered",
    at: "2026-07-27T14:22:05Z",
  },
  {
    id: "al_3",
    contact: "Luis Ortiz",
    flow: "Missed-call text-back",
    event: "Enrollment",
    step: "Trigger: Incoming keyword MISSED",
    status: "Complete",
    at: "2026-07-27T11:08:00Z",
  },
  {
    id: "al_4",
    contact: "Luis Ortiz",
    flow: "Missed-call text-back",
    event: "Action",
    step: "Send SMS: Sorry we missed you",
    status: "Delivered",
    at: "2026-07-27T11:08:02Z",
  },
  {
    id: "al_5",
    contact: "Priya Shah",
    flow: "No-response follow-up",
    event: "Skip",
    step: "Condition: Replied to previous message",
    status: "Complete",
    at: "2026-07-26T09:15:00Z",
  },
  {
    id: "al_6",
    contact: "Drew Kim",
    flow: "Welcome series",
    event: "Failure",
    step: "Send SMS: Welcome message",
    status: "Failed",
    at: "2026-07-25T16:40:00Z",
  },
  {
    id: "al_7",
    contact: "Nina Brooks",
    flow: "Welcome series",
    event: "Completion",
    step: "End: Flow finished",
    status: "Complete",
    at: "2026-07-24T10:00:00Z",
  },
  {
    id: "al_8",
    contact: "Sam Rivera",
    flow: "No-response follow-up",
    event: "Action",
    step: "Send SMS: Follow-up nudge",
    status: "Delivered",
    at: "2026-07-23T08:30:00Z",
  },
  {
    id: "al_9",
    contact: "Alex Turner",
    flow: "Birthday message",
    event: "Skip",
    step: "Condition: Contact unsubscribed",
    status: "Complete",
    at: "2026-07-22T06:00:00Z",
  },
  {
    id: "al_10",
    contact: "Jordan Lee",
    flow: "Welcome series",
    event: "Action",
    step: "Wait: 24 hours",
    status: "Pending",
    at: "2026-07-21T12:00:00Z",
  },
];

const eventStyles: Record<string, string> = {
  Enrollment: "bg-emerald-50 text-emerald-700",
  Action: "bg-sky-50 text-sky-700",
  Skip: "bg-slate-100 text-slate-700",
  Failure: "bg-rose-50 text-rose-700",
  Completion: "bg-violet-50 text-violet-700",
};

function formatDateTime(at: string) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AutomationLogsPage() {
  const enrollments = automationLogs.filter((l) => l.event === "Enrollment").length;
  const actions = automationLogs.filter((l) => l.event === "Action").length;
  const failures = automationLogs.filter((l) => l.event === "Failure").length;

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Automation logs"
        description="Track enrollments, actions, skips, failures, and completions across all flows."
      />

      <Tabs items={automationTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Enrollments"
          value={formatNumber(enrollments)}
          icon={UserPlus}
          tone="bg-emerald-50 text-emerald-600"
          sparkline={[1, 1, 1, 2, 2, 2, 2, 2]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Actions taken"
          value={formatNumber(actions)}
          icon={Zap}
          tone="bg-sky-50 text-sky-600"
          sparkline={[1, 2, 2, 3, 3, 4, 4, 4]}
          sparkColor="#3b82f6"
        />
        <MetricCard
          label="Failures"
          value={formatNumber(failures)}
          hint="Last 7 days"
          icon={AlertTriangle}
          tone="bg-violet-50 text-violet-600"
          sparkline={[0, 0, 1, 1, 1, 1, 1, 1]}
          sparkColor="#8b5cf6"
        />
      </div>

      <Card className="rounded-[12px] p-4">
        <h2 className="mb-4 text-[14px] font-bold text-foreground">Event log</h2>
        <div className="overflow-x-auto">
          <Table className="min-w-[900px] text-[13px]">
            <THead>
              <TR>
                <TH>
                  <span className="inline-flex items-center gap-1">
                    Time
                    <ArrowDown className="h-3 w-3" />
                  </span>
                </TH>
                <TH>Contact</TH>
                <TH>Flow</TH>
                <TH>Event</TH>
                <TH>Step</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {automationLogs.map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.at)}
                  </TD>
                  <TD className="font-semibold">{log.contact}</TD>
                  <TD className="text-muted-foreground">{log.flow}</TD>
                  <TD>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        eventStyles[log.event] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {log.event}
                    </span>
                  </TD>
                  <TD className="max-w-[240px] text-muted-foreground">{log.step}</TD>
                  <TD>
                    <StatusChip status={log.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <PaginationBar
          rangeLabel={`Showing 1 to ${automationLogs.length} of ${automationLogs.length} events`}
        />
      </Card>
    </div>
  );
}
