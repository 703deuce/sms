import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { loadAuditLogs, requireWorkspaceContext } from "@/lib/workspace-data";

const reportTabs = [
  { label: "Overview", href: "/reports" },
  { label: "Campaigns", href: "/reports/campaigns" },
  { label: "Messages", href: "/reports/messages" },
  { label: "Contacts", href: "/reports/contacts" },
  { label: "Inbox", href: "/reports/inbox" },
  { label: "Automations", href: "/reports/automations" },
  { label: "Links", href: "/reports/links" },
  { label: "Usage", href: "/reports/usage" },
  { label: "Audit log", href: "/reports/audit-log" },
];

export default async function ReportsAuditLogPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const auditLogs = await loadAuditLogs(workspaceId);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Account activity including campaign sends, imports, and permission changes."
        actions={<Button variant="outline">Export log</Button>}
      />

      <Tabs items={reportTabs} />

      <Card>
        <CardTitle>Recent activity</CardTitle>
        {auditLogs.length === 0 ? (
          <EmptyState title="No audit events" description="Account activity will be logged here." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Event</TH>
                <TH>Actor</TH>
                <TH>Detail</TH>
              </TR>
            </THead>
            <TBody>
              {auditLogs.map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {new Date(entry.at).toLocaleString()}
                  </TD>
                  <TD className="font-medium">{entry.event}</TD>
                  <TD>{entry.actor}</TD>
                  <TD className="text-muted-foreground">{entry.detail}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
