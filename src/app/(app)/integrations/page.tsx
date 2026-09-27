import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { Tabs } from "@/components/ui/tabs";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { Stat } from "@/newui-transplant/components/app/kit";
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
import { IntegrationsHomeClient } from "./integrations-home-client";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "Calendars", href: "/integrations?provider=calendar" },
  { label: "Payments", href: "/integrations?provider=stripe" },
  { label: "Connect apps", href: "/integrations/native" },
  { label: "CRM", href: "/integrations/crm" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const params = await searchParams;
  const focusProvider =
    typeof params.provider === "string"
      ? params.provider
      : typeof params.focus === "string"
        ? params.focus
        : null;
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

  const opus = isNewUiStage2Enabled();

  const stats = opus ? (
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Stat label="Connected" value={String(totalConnected)} hint="Active integrations" />
      <Stat label="API keys" value={String(apiKeys.length)} hint={connectedApi ? "Active keys configured" : "No keys yet"} href="/integrations/api" />
      <Stat
        label="Outbound webhooks"
        value={String(webhooks.length)}
        hint={webhooks.length > 0 ? "Event destinations" : "None configured"}
        href="/integrations/webhooks"
      />
    </div>
  ) : (
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
  );

  return (
    <div className="space-y-5">
      {!opus ? (
        <>
          <SectionHeader
            title="Integrations"
            description="Connect Transovo with the tools you already use."
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
        </>
      ) : null}

      {stats}

      <IntegrationsHomeClient
        connectedApi={connectedApi}
        connectedWebhooks={connectedWebhooks}
        endpointsCount={endpoints.length}
        focusProvider={focusProvider}
      />
    </div>
  );
}
