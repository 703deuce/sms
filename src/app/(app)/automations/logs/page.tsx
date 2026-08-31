import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { ScrollText } from "lucide-react";
import {
  loadAuditLogs,
  loadAutomations,
  requireWorkspaceContext,
} from "@/lib/workspace-data";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

export default async function AutomationsLogsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [automations, auditLogs] = await Promise.all([
    loadAutomations(workspaceId),
    loadAuditLogs(workspaceId),
  ]);

  const logs = auditLogs
    .filter((l) => (l.event || "").startsWith("automation."))
    .map((l) => ({
      id: l.id,
      flow: l.detail?.match(/flow=([^ ]+)/)?.[1] || "Automation",
      event: l.event,
      detail: l.detail || "",
      status: "Complete",
      at: l.at,
    }));

  const flowById = new Map(automations.map((a) => [a.id, a.name]));
  const enrolled = automations.reduce((s, a) => s + a.enrolled, 0);
  const messagesSent = automations.reduce((s, a) => s + a.messagesSent, 0);

  return (
    <div>
      <PageHeader
        title="Automation logs"
        description="Enrollment and send activity from your automation flows."
      />
      <Tabs items={automationTabs} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active flows" value={formatNumber(automations.filter((a) => a.status === "Active").length)} />
        <StatCard label="Enrolled" value={formatNumber(enrolled)} />
        <StatCard label="Messages sent" value={formatNumber(messagesSent)} />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <CardTitle>Recent activity</CardTitle>
          {logs.length > 0 ? (
            <span className="text-[11px] font-medium text-muted-foreground">
              {logs.length} events
            </span>
          ) : null}
        </div>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <ScrollText className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">No activity yet</p>
            <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
              No automation activity yet. Activate a flow to start logging enrollments and sends.
            </p>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <Table className="mt-2">
              <THead>
                <TR>
                  <TH>Flow</TH>
                  <TH>Event</TH>
                  <TH>Detail</TH>
                  <TH>Status</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {logs.map((log) => (
                  <TR key={log.id}>
                    <TD className="font-medium">
                      {flowById.get(log.flow) || log.flow}
                    </TD>
                    <TD>
                      <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground/80">
                        {log.event}
                      </span>
                    </TD>
                    <TD className="max-w-xs truncate text-muted-foreground">{log.detail}</TD>
                    <TD>
                      <StatusChip status={log.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {new Date(log.at).toLocaleString()}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
