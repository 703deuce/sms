import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Plus, Webhook } from "lucide-react";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

const webhookEndpoints = [
  {
    id: "wh_1",
    url: "https://hooks.harborhome.co/transovo",
    events: ["message.delivered", "message.failed", "message.inbound"],
    status: "Active" as const,
    lastDelivery: "2026-07-27T16:42:00Z",
    successRate: 99.2,
  },
  {
    id: "wh_2",
    url: "https://api.example.com/sms-events",
    events: ["contact.subscribed", "contact.unsubscribed"],
    status: "Active" as const,
    lastDelivery: "2026-07-26T11:05:00Z",
    successRate: 100,
  },
  {
    id: "wh_3",
    url: "https://staging.harborhome.co/webhooks/sms",
    events: ["campaign.completed"],
    status: "Paused" as const,
    lastDelivery: "2026-07-20T10:00:00Z",
    successRate: 94.5,
  },
];

const eventTypes = [
  "message.delivered",
  "message.failed",
  "message.inbound",
  "contact.subscribed",
  "contact.unsubscribed",
  "campaign.completed",
  "campaign.failed",
];

export default function IntegrationsWebhooksPage() {
  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Receive real-time push notifications for delivery, inbound messages, and subscription events."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Add endpoint
          </Button>
        }
      />

      <Tabs items={integrationTabs} />

      <Card className="mb-4">
        <div className="mb-4 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <CardTitle>Webhook endpoints</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Endpoint URL</TH>
              <TH>Events</TH>
              <TH>Status</TH>
              <TH>Last delivery</TH>
              <TH>Success rate</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {webhookEndpoints.map((endpoint) => (
              <TR key={endpoint.id}>
                <TD className="max-w-[240px] truncate font-mono text-sm">{endpoint.url}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {endpoint.events.map((event) => (
                      <span
                        key={event}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </TD>
                <TD>
                  <StatusChip status={endpoint.status} />
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(endpoint.lastDelivery).toLocaleString()}
                </TD>
                <TD>{endpoint.successRate}%</TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardTitle>Create webhook endpoint</CardTitle>
        <form className="mt-4 space-y-4">
          <div>
            <Label htmlFor="webhookUrl">Endpoint URL</Label>
            <Input id="webhookUrl" placeholder="https://your-server.com/webhooks/transovo" />
          </div>
          <div>
            <Label htmlFor="webhookSecret">Signing secret (optional)</Label>
            <Input id="webhookSecret" placeholder="whsec_..." />
          </div>
          <div>
            <Label htmlFor="webhookEvents">Events</Label>
            <Select id="webhookEvents" multiple defaultValue={["message.delivered"]}>
              {eventTypes.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Hold Ctrl/Cmd to select multiple events.
            </p>
          </div>
          <Button type="button">Create endpoint</Button>
        </form>
      </Card>
    </div>
  );
}
