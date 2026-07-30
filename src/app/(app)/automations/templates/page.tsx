import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/catalog";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

/**
 * Workflow templates = the same 14 campaign categories.
 * EZ Texting-style specialized names (keyword welcome, form welcome, estimate follow-up)
 * collapse into Welcome / Follow-up / etc. with different triggers.
 */
export default function AutomationTemplatesPage() {
  return (
    <div>
      <PageHeader
        title="Workflow templates"
        description="Fourteen core workflows — not hundreds of near-duplicates. Keyword welcome and form welcome share the Welcome engine; estimate and appointment follow-ups share Follow-up."
        actions={
          <Link href="/automations/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover">Blank custom workflow</Link>
        }
      />
      <Tabs items={automationTabs} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPAIGN_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon];
          return (
            <Link
              key={cat.id}
              href={cat.id === "custom" ? "/automations/new" : `/campaigns/new/${cat.id}`}
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
