import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

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
    <div>
      <PageHeader
        title="Automation logs"
        description="Track enrollments, actions, skips, failures, and completions across all flows."
      />

      <Tabs items={automationTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Enrollments" value={formatNumber(enrollments)} />
        <StatCard label="Actions taken" value={formatNumber(actions)} />
        <StatCard label="Failures" value={formatNumber(failures)} hint="Last 7 days" />
      </div>

      <Card>
        <CardTitle>Event log</CardTitle>
        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
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
                  <TD className="font-medium">{log.contact}</TD>
                  <TD className="text-muted-foreground">{log.flow}</TD>
                  <TD>
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {log.event}
                    </span>
                  </TD>
                  <TD className="max-w-xs truncate text-muted-foreground">{log.step}</TD>
                  <TD>
                    <StatusChip status={log.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
