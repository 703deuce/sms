import { WebhooksPanel } from "@/components/integrations/webhooks-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import {
  loadIntegrationEndpoints,
  loadIntegrationWebhookEvents,
  loadOutboundWebhooks,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { Plus } from "lucide-react";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

export default async function IntegrationsWebhooksPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [endpoints, outbound, events] = await Promise.all([
    loadIntegrationEndpoints(workspaceId),
    loadOutboundWebhooks(workspaceId),
    loadIntegrationWebhookEvents(workspaceId),
  ]);

  const base = getAppBaseUrl();
  const eventStats = new Map<string, { lastAt: string | null; successRate: number | null }>();
  for (const ep of endpoints) {
    const epEvents = events.filter((e) => e.endpointName === ep.name);
    const processed = epEvents.filter((e) => e.status === "processed").length;
    const lastAt = epEvents[0]?.at || null;
    eventStats.set(ep.id, {
      lastAt,
      successRate: epEvents.length > 0 ? Math.round((processed / epEvents.length) * 1000) / 10 : null,
    });
  }

  const endpointRows = endpoints.map((ep) => ({
    id: ep.id,
    name: ep.name,
    incomingUrl: `${base}/api/integrations/webhooks/incoming/${ep.token}`,
    active: ep.active && !ep.revokedAt,
    createdAt: ep.createdAt.toISOString(),
    lastEventAt: eventStats.get(ep.id)?.lastAt || null,
    successRate: eventStats.get(ep.id)?.successRate ?? null,
  }));

  const outboundRows = outbound.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    active: w.active,
  }));

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Receive real-time push notifications for delivery, inbound messages, and subscription events."
        actions={
          <Button disabled>
            <Plus className="h-4 w-4" />
            Add endpoint
          </Button>
        }
      />

      <Tabs items={integrationTabs} />

      <WebhooksPanel endpoints={endpointRows} outbound={outboundRows} />
    </div>
  );
}
