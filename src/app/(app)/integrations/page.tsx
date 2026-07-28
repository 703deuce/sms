import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { integrationsDirectory } from "@/lib/mock/data";
import { ExternalLink, Puzzle } from "lucide-react";
import Link from "next/link";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

const integrationLinks: Record<string, string> = {
  API: "/integrations/api",
  Webhooks: "/integrations/webhooks",
};

export default function IntegrationsPage() {
  const available = integrationsDirectory.filter((i) => i.status === "Available");
  const comingSoon = integrationsDirectory.filter((i) => i.status === "Coming soon");

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect Transovo SMS to your CRM, automation tools, and custom applications."
        actions={
          <Link href="/integrations/api">
            <Button variant="outline">Manage API keys</Button>
          </Link>
        }
      />

      <Tabs items={integrationTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available</p>
          <p className="mt-2 font-display text-2xl font-semibold">{available.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coming soon</p>
          <p className="mt-2 font-display text-2xl font-semibold">{comingSoon.length}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-primary" />
          <CardTitle>Integration directory</CardTitle>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {integrationsDirectory.map((item) => {
            const href = integrationLinks[item.name];
            const inner = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.name}</p>
                  <StatusChip status={item.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                {href && item.status === "Available" ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Configure
                    <ExternalLink className="h-3 w-3" />
                  </span>
                ) : null}
              </>
            );

            if (href && item.status === "Available") {
              return (
                <Link
                  key={item.name}
                  href={href}
                  className="rounded-lg border border-border p-4 transition hover:border-primary/40 hover:bg-muted/30"
                >
                  {inner}
                </Link>
              );
            }

            return (
              <div key={item.name} className="rounded-lg border border-border p-4">
                {inner}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
