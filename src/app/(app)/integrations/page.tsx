import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { integrationsDirectory } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bell,
  Filter,
  Puzzle,
  Search,
} from "lucide-react";
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

const logoTones = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-orange-100 text-orange-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

export default function IntegrationsPage() {
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
        iconTone="bg-violet-50 text-violet-600"
        actions={
          <>
            <Link href="/integrations/api">
              <Button variant="outline" className="rounded-[10px]">
                Manage API keys
              </Button>
            </Link>
            <Button className="rounded-[10px]">+ Add integration</Button>
          </>
        }
      />

      <Tabs items={integrationTabs} />

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
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              Available
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${availablePct}%` }}
            />
          </div>
          <Link
            href="/integrations"
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
              <p className="mt-1 text-[12px] text-muted-foreground">Planned</p>
            </div>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              Coming soon
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${comingSoonPct}%` }}
            />
          </div>
          <Link
            href="/integrations"
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            View roadmap
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
          {integrationsDirectory.map((item, index) => {
            const href = integrationLinks[item.name];
            const letter = item.name.charAt(0).toUpperCase();
            const tone = logoTones[index % logoTones.length];
            const isAvailable = item.status === "Available";

            const inner = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold",
                      tone,
                    )}
                  >
                    {letter}
                  </span>
                  <StatusChip status={item.status} />
                </div>
                <p className="mt-3 text-[14px] font-semibold text-foreground">{item.name}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <div className="mt-4 border-t border-border pt-3">
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                      Configure
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
              <div
                key={item.name}
                className="rounded-[12px] border border-border p-4"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
