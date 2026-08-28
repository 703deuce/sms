import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/catalog";
import { playbookHref } from "@/lib/campaigns/playbook-routes";
import { INTEGRATION_AUTOMATION_TEMPLATES } from "@/lib/automations/integration-templates";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
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
          <Link href="/automations/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover">Blank custom workflow</Link>
        }
      />
      <Tabs items={automationTabs} />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        CRM &amp; Calendly starters
      </h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATION_AUTOMATION_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/automations/new?template=${encodeURIComponent(t.id)}`}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{t.group}</p>
            <h3 className="mt-1 font-semibold text-slate-900">{t.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{t.description}</p>
            <p className="mt-3 text-xs text-slate-500">
              Trigger: {t.triggerBlockType}
              {t.providerHint ? ` · ${t.providerHint}` : ""}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-800">
              Open in builder <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Messaging workflows
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPAIGN_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon];
          return (
            <Link
              key={cat.id}
              href={playbookHref(cat)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-xl p-2.5", cat.tone)}>
                  {Icon ? <Icon className="h-5 w-5" /> : null}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{cat.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{cat.description}</p>
                  <p className="mt-3 text-xs text-slate-500">{cat.examples.join(" · ")}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-800">
                    Use template <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
