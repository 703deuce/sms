"use client";

import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { PageHeader } from "@/components/ui/page-header";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/catalog";
import { playbookHref } from "@/lib/campaigns/playbook-routes";
import { cn } from "@/lib/utils";
import { ArrowRight, LayoutList, Plus } from "lucide-react";
import Link from "next/link";

export default function PlaybooksPage() {
  return (
    <div>
      <PageHeader
        title="Playbooks"
        description="What do you want to do? Pick an intent — we'll route you to the right campaign or automation."
        actions={
          <Link
            href="/campaigns"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <LayoutList className="h-4 w-4" />
            View campaigns
          </Link>
        }
      />

      <div className="mb-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">What do you want to do?</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Each card is a ready-made starting point. Announcements open the campaign composer;
          follow-ups and welcome flows create automations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPAIGN_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon] || LayoutList;
          return (
            <Link
              key={cat.id}
              href={playbookHref(cat)}
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-xl p-2.5", cat.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{cat.title}</h3>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-600" />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{cat.description}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    e.g. {cat.examples.slice(0, 3).join(" · ")}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-800">
                    <Plus className="h-3.5 w-3.5" />
                    {cat.cta}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
