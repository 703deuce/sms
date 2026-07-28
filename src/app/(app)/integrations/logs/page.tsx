import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Terminal } from "lucide-react";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

const developerLogs = [
  {
    id: "dl_1",
    at: "2026-07-27T16:42:12Z",
    method: "POST",
    path: "/v1/messages",
    status: 201,
    duration: 142,
    source: "Production key",
  },
  {
    id: "dl_2",
    at: "2026-07-27T16:40:05Z",
    method: "GET",
    path: "/v1/contacts?limit=50",
    status: 200,
    duration: 89,
    source: "Production key",
  },
  {
    id: "dl_3",
    at: "2026-07-27T14:22:00Z",
    method: "POST",
    path: "/v1/webhooks/test",
    status: 200,
    duration: 312,
    source: "Production key",
  },
  {
    id: "dl_4",
    at: "2026-07-27T09:10:44Z",
    method: "POST",
    path: "/v1/campaigns",
    status: 422,
    duration: 56,
    source: "Staging key",
  },
  {
    id: "dl_5",
    at: "2026-07-26T18:30:00Z",
    method: "GET",
    path: "/v1/campaigns/camp_1",
    status: 200,
    duration: 67,
    source: "Production key",
  },
  {
    id: "dl_6",
    at: "2026-07-26T11:05:22Z",
    method: "POST",
    path: "/v1/contacts/import",
    status: 202,
    duration: 1840,
    source: "Production key",
  },
];

export default function IntegrationsLogsPage() {
  const errors = developerLogs.filter((l) => l.status >= 400).length;

  return (
    <div>
      <PageHeader
        title="Developer logs"
        description="API request history, response codes, and latency for debugging integrations."
        actions={<Button variant="outline">Export logs</Button>}
      />

      <Tabs items={integrationTabs} />

      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{developerLogs.length} requests (last 24h)</span>
        <span>{errors} errors</span>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <CardTitle>Request log</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Time</TH>
              <TH>Method</TH>
              <TH>Path</TH>
              <TH>Status</TH>
              <TH>Duration</TH>
              <TH>Source</TH>
            </TR>
          </THead>
          <TBody>
            {developerLogs.map((log) => (
              <TR key={log.id}>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(log.at).toLocaleString()}
                </TD>
                <TD>
                  <span className="font-mono text-xs font-medium">{log.method}</span>
                </TD>
                <TD className="max-w-[280px] truncate font-mono text-sm">{log.path}</TD>
                <TD>
                  <StatusChip
                    status={log.status >= 400 ? "Failed" : log.status >= 200 ? "Delivered" : "Pending"}
                  />
                  <span className="ml-2 text-sm text-muted-foreground">{log.status}</span>
                </TD>
                <TD>{log.duration}ms</TD>
                <TD className="text-muted-foreground">{log.source}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
