import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { Tabs } from "@/components/ui/tabs";
import {
  loadApiKeys,
  loadIntegrationEndpoints,
  loadOutboundWebhooks,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { listConnections, isStripeEnvConfigured } from "@/lib/integrations/connections";
import { getPrisma } from "@/lib/db";
import { Plus, Puzzle } from "lucide-react";
import Link from "next/link";
import { ConnectableProvidersGrid } from "@/components/integrations/connectable-providers-grid";
import { IntegrationsDirectory } from "./integrations-directory";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "Connect apps", href: "/integrations/native" },
  { label: "CRM", href: "/integrations/crm" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

export default async function IntegrationsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [apiKeys, endpoints, webhooks, connections, workspace] = await Promise.all([
    loadApiKeys(workspaceId),
    loadIntegrationEndpoints(workspaceId),
    loadOutboundWebhooks(workspaceId),
    listConnections(workspaceId),
    getPrisma().workspace.findUnique({ where: { id: workspaceId }, select: { stripeCustomerId: true } }),
  ]);

  const connectedApi = apiKeys.length > 0;
  const connectedWebhooks = webhooks.length > 0 || endpoints.length > 0;
  const stripeConnected = isStripeEnvConfigured() || Boolean(workspace?.stripeCustomerId);

  const connectedConnectors = connections.filter((c) => c.status === "connected").length;
  const totalConnected =
    connectedConnectors +
    (connectedApi ? 1 : 0) +
    (connectedWebhooks ? 1 : 0) +
    (stripeConnected ? 1 : 0);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Integrations"
        description="Connect Transovo SMS to your CRM, payments, calendar, and custom applications."
        icon={Puzzle}
        iconTone="bg-violet-50 text-violet-600"
        actions={
          <Link href="/integrations/api">
            <Button variant="outline" className="rounded-[10px]">
              <Plus className="h-4 w-4" />
              Manage API keys ({apiKeys.length})
            </Button>
          </Link>
        }
      />

      <Tabs items={integrationTabs} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Connected</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight">{totalConnected}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Active integrations</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">API keys</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight">{apiKeys.length}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{connectedApi ? "Active keys configured" : "No keys yet"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Outbound webhooks</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight">{webhooks.length}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{webhooks.length > 0 ? "Event destinations" : "None configured"}</p>
        </Card>
      </div>

      <ConnectableProvidersGrid />

      <IntegrationsDirectory
        connectedApi={connectedApi}
        connectedWebhooks={connectedWebhooks}
        endpointsCount={endpoints.length}
      />
    </div>
  );
}
