import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { IntegrationsLogsOpus } from "@/newui-transplant/connected/integrations/integrations-logs-opus";
import { titleCaseStatus } from "@/lib/mappers";
import { loadIntegrationWebhookEvents, requireWorkspaceContext } from "@/lib/workspace-data";
import { Terminal } from "lucide-react";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

function logStatus(status: string) {
  if (status === "failed") return "Failed";
  if (status === "processed") return "Delivered";
  return "Pending";
}

export default async function IntegrationsLogsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const events = await loadIntegrationWebhookEvents(workspaceId);
  const errors = events.filter((e) => e.status === "failed").length;

  const opus = isNewUiStage2Enabled();

  const logBody = (
    <>
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{events.length} webhook events</span>
        <span>{errors} errors</span>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <CardTitle>Request log</CardTitle>
        </div>
        {events.length === 0 ? (
          <EmptyState
            title="No developer logs"
            description="Incoming webhook events and API activity will appear here for debugging."
            actionLabel="Configure webhooks"
            actionHref="/integrations/webhooks"
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Endpoint</TH>
                <TH>Status</TH>
                <TH>Error</TH>
              </TR>
            </THead>
            <TBody>
              {events.map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {new Date(log.at).toLocaleString()}
                  </TD>
                  <TD className="font-medium">{log.endpointName}</TD>
                  <TD>
                    <StatusChip status={logStatus(log.status)} />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {titleCaseStatus(log.status)}
                    </span>
                  </TD>
                  <TD className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {log.error || "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );

  if (opus) {
    return (
      <IntegrationsLogsOpus
        events={events.map((log) => ({
          id: log.id,
          at: log.at.toISOString(),
          endpointName: log.endpointName,
          status: log.status,
          error: log.error,
        }))}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Developer logs"
        description="API request history, response codes, and latency for debugging integrations."
        actions={<Button variant="outline">Export logs</Button>}
      />

      <Tabs items={integrationTabs} />

      {logBody}
    </div>
  );
}
