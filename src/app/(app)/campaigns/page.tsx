"use client";

import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { CAMPAIGN_CATEGORIES } from "@/lib/campaigns/catalog";
import { cn } from "@/lib/utils";
import { ArrowRight, LayoutList, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCampaignTabs } from "@/hooks/use-campaign-tabs";

type LiveCampaign = {
  id: string;
  name: string;
  category?: string | null;
  status: string;
  sent?: number;
  createdAt?: string;
};

export default function CampaignsPage() {
  const [recent, setRecent] = useState<LiveCampaign[]>([]);
  const tabs = useCampaignTabs();

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setRecent(json.data.slice(0, 5));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Fourteen core campaign types — not hundreds of near-duplicates. Pick a workflow, then set the trigger, delay, and message."
        actions={
          <Link href="/campaigns/all" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"><LayoutList className="h-4 w-4" />
              View all campaigns</Link>
        }
      />

      <Tabs items={tabs} />

      <div className="mb-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">What do you want to do?</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Each card is one reusable engine. Content, timing, and triggers change — the campaign type stays the same.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CAMPAIGN_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.icon] || MegaphoneFallback;
          return (
            <Link
              key={cat.id}
              href={`/campaigns/new/${cat.id}`}
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

      {recent.length > 0 && (
        <Card className="mt-10 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent campaigns</h2>
            <Link href="/campaigns/all" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">See all</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {c.category || "campaign"} · {c.sent ?? 0} sent
                  </p>
                </div>
                <StatusChip status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function MegaphoneFallback(props: { className?: string }) {
  return <LayoutList {...props} />;
}
