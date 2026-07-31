import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import {
  loadApiKeys,
  loadIntegrationEndpoints,
  loadOutboundWebhooks,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bell,
  Calendar,
  Cloud,
  Contact,
  CreditCard,
  Filter,
  GitBranch,
  Plus,
  Puzzle,
  Rocket,
  Search,
  Sheet,
  ShoppingBag,
  Terminal,
  Webhook,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

const integrationsDirectory = [
  { name: "API", status: "Available", description: "REST API for contacts, campaigns, and messages." },
  { name: "Webhooks", status: "Available", description: "Push delivery, inbound, and subscription events." },
  { name: "Zapier", status: "Available", description: "Connect Transovo SMS to 5,000+ apps." },
  { name: "HubSpot", status: "Coming soon", description: "Sync contacts and trigger SMS from CRM events." },
  { name: "Salesforce", status: "Coming soon", description: "Bi-directional contact and campaign sync." },
  { name: "Shopify", status: "Coming soon", description: "Order and abandoned-cart messaging." },
  { name: "Stripe", status: "Coming soon", description: "Payment event notifications." },
  { name: "Calendly", status: "Coming soon", description: "Appointment reminders from bookings." },
  { name: "Google Contacts", status: "Coming soon", description: "Import contacts securely." },
  { name: "Google Sheets", status: "Coming soon", description: "Sync lists from spreadsheets." },
];

const integrationLinks: Record<string, string> = {
  API: "/integrations/api",
  Webhooks: "/integrations/webhooks",
  Zapier: "/integrations/api",
};

const integrationMeta: Record<string, { icon: LucideIcon; tone: string }> = {
  API: { icon: Terminal, tone: "bg-slate-900 text-white" },
  Webhooks: { icon: Webhook, tone: "bg-blue-100 text-blue-700" },
  Zapier: { icon: Zap, tone: "bg-orange-100 text-orange-600" },
  HubSpot: { icon: GitBranch, tone: "bg-orange-100 text-orange-700" },
  Salesforce: { icon: Cloud, tone: "bg-sky-100 text-sky-700" },
  Shopify: { icon: ShoppingBag, tone: "bg-emerald-100 text-emerald-700" },
  Stripe: { icon: CreditCard, tone: "bg-violet-100 text-violet-700" },
  Calendly: { icon: Calendar, tone: "bg-blue-100 text-blue-600" },
  "Google Contacts": { icon: Contact, tone: "bg-sky-100 text-sky-600" },
  "Google Sheets": { icon: Sheet, tone: "bg-emerald-100 text-emerald-700" },
};

export default async function IntegrationsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [apiKeys, endpoints, webhooks] = await Promise.all([
    loadApiKeys(workspaceId),
    loadIntegrationEndpoints(workspaceId),
    loadOutboundWebhooks(workspaceId),
  ]);

  const connectedApi = apiKeys.length > 0;
  const connectedWebhooks = webhooks.length > 0 || endpoints.length > 0;

  const available = integrationsDirectory.filter((i) => i.status === "Available");
  const comingSoon = integrationsDirectory.filter((i) => i.status === "Coming soon");
  const total = integrationsDirectory.length;
  const availablePct = Math.round((available.length / total) * 100);
  const comingSoonPct = Math.round((comingSoon.length / total) * 100);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Integrations"
        description="Connect Transovo SMS to your CRM, automation tools, and custom applications."
        icon={Puzzle}
        iconTone="bg-emerald-50 text-emerald-600"
        actions={
          <>
            <Link href="/integrations/api">
              <Button variant="outline" className="rounded-[10px]">
                Manage API keys ({apiKeys.length})
              </Button>
            </Link>
            <Button className="rounded-[10px]">
              <Plus className="h-4 w-4" />
              Add integration
            </Button>
          </>
        }
      />

      <Tabs items={integrationTabs} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">API keys</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight">{apiKeys.length}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{connectedApi ? "Active keys configured" : "No keys yet"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Inbound webhooks</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight">{endpoints.length}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Automation endpoints</p>
        </Card>
        <Card className="p-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Outbound webhooks</p>
          <p className="mt-2 text-[28px] font-bold tracking-tight">{webhooks.length}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{connectedWebhooks ? "Event destinations" : "None configured"}</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Available Integrations
              </p>
              <p className="mt-2 text-[28px] font-bold tracking-tight text-foreground">
                {available.length}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">Ready to connect</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
              <Puzzle className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${availablePct}%` }} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Coming Soon
              </p>
              <p className="mt-2 text-[28px] font-bold tracking-tight text-foreground">
                {comingSoon.length}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">Planned integrations</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sky-50 text-sky-600">
              <Rocket className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${comingSoonPct}%` }} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[14px] font-bold text-foreground">Integration directory</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-full min-w-[200px] rounded-[10px] border border-border bg-card pl-9 pr-3 text-[13px] outline-none focus:border-primary sm:w-56"
                placeholder="Search integrations..."
              />
            </div>
            <Button variant="outline" size="sm" className="rounded-[10px]">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {integrationsDirectory.map((item) => {
            const href = integrationLinks[item.name];
            const meta = integrationMeta[item.name] ?? {
              icon: Puzzle,
              tone: "bg-muted text-muted-foreground",
            };
            const Icon = meta.icon;
            const isAvailable = item.status === "Available";
            const isConnected =
              item.name === "API" && connectedApi ||
              item.name === "Webhooks" && connectedWebhooks ||
              item.name === "Zapier" && endpoints.length > 0;

            const inner = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <StatusChip status={isConnected ? "Active" : item.status} />
                </div>
                <p className="mt-3 text-[14px] font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <div className="mt-4 border-t border-border pt-3">
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                      {isConnected ? "Manage" : "Configure"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                      <Bell className="h-3.5 w-3.5" />
                      Notify me
                    </span>
                  )}
                </div>
              </>
            );

            if (href && isAvailable) {
              return (
                <Link
                  key={item.name}
                  href={href}
                  className="rounded-[12px] border border-border p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  {inner}
                </Link>
              );
            }

            return (
              <div key={item.name} className="rounded-[12px] border border-border p-4">
                {inner}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
