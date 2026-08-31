import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/catalog";
import { playbookHref } from "@/lib/campaigns/playbook-routes";
import { INTEGRATION_AUTOMATION_TEMPLATES } from "@/lib/automations/integration-templates";
import { cn } from "@/lib/utils";
import { ArrowRight, Plug } from "lucide-react";
import Link from "next/link";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

/**
 * Workflow templates = campaign categories + CRM/Calendly starters.
 * Integration templates never auto-activate — open the builder and configure.
 */
export default function AutomationTemplatesPage() {
  return (
    <div>
      <PageHeader
        title="Workflow templates"
        description="Core messaging workflows plus CRM and Calendly starters for Salesforce, Zoho, Pipedrive, and Calendly."
        actions={
          <Link
            href="/automations/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            Blank custom workflow
          </Link>
        }
      />
      <Tabs items={automationTabs} />

      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        CRM &amp; Calendly starters
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATION_AUTOMATION_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/automations/new?template=${encodeURIComponent(t.id)}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Plug className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.group}
              </p>
            </div>
            <h3 className="mt-2.5 text-[14px] font-semibold text-foreground">{t.title}</h3>
            <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {t.description}
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground/80">
              Trigger: {t.triggerBlockType}
              {t.providerHint ? ` · ${t.providerHint}` : ""}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 transition-colors group-hover:text-indigo-700">
              Open in builder
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Messaging workflows
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPAIGN_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon];
          return (
            <Link
              key={cat.id}
              href={playbookHref(cat)}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-xl p-2.5", cat.tone)}>
                  {Icon ? <Icon className="h-5 w-5" /> : null}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-foreground">{cat.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-[11px] text-muted-foreground/80">
                {cat.examples.join(" · ")}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 transition-colors group-hover:text-indigo-700">
                Use template
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
