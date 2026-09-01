"use client";

import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { V1PageHeader } from "@/components/v1/v1-polish";
import { CAMPAIGN_CATEGORIES, type CampaignCategory } from "@/lib/campaigns/catalog";
import { playbookHref } from "@/lib/campaigns/playbook-routes";
import { ENGINE_LABELS, PLAYBOOK_EMOJIS } from "@/lib/v1/playbook-emojis";
import { cn } from "@/lib/utils";
import { ArrowRight, LayoutList, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const ENGINE_ORDER: CampaignCategory["engine"][] = ["broadcast", "sequence", "automation"];

function PlaybookCard({ cat }: { cat: CampaignCategory }) {
  const Icon = CATEGORY_ICONS[cat.icon] || LayoutList;
  const emoji = PLAYBOOK_EMOJIS[cat.id];
  const engine = ENGINE_LABELS[cat.engine];

  return (
    <Link
      href={playbookHref(cat)}
      className="group block rounded-[14px] border border-border bg-card p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className={cn("rounded-[12px] p-2.5", cat.tone)}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="absolute -right-1 -top-1 text-[16px] drop-shadow-sm">{emoji}</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground group-hover:text-indigo-700">
              {cat.title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{cat.description}</p>
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {engine.emoji} {engine.label}
        </span>
        <span className="text-[11px] text-muted-foreground">
          e.g. {cat.examples.slice(0, 2).join(" · ")}
        </span>
      </div>
      <p className="mt-3 text-[12px] font-semibold text-indigo-600">{cat.cta} →</p>
    </Link>
  );
}

export function PlaybooksView() {
  const grouped = useMemo(() => {
    const map = new Map<CampaignCategory["engine"], CampaignCategory[]>();
    for (const engine of ENGINE_ORDER) map.set(engine, []);
    for (const cat of CAMPAIGN_CATEGORIES) {
      map.get(cat.engine)?.push(cat);
    }
    return ENGINE_ORDER.map((engine) => ({
      engine,
      meta: ENGINE_LABELS[engine],
      items: map.get(engine) || [],
    }));
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] px-1 pb-10">
      <V1PageHeader
        emoji="📚"
        title="Playbooks"
        description="Pick what you want to accomplish — we'll route you to the right campaign, sequence, or automation builder. Every card is a ready-made starting point."
        actions={
          <Link
            href="/campaigns"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground shadow-sm hover:bg-muted"
          >
            <LayoutList className="h-4 w-4" />
            View campaigns
          </Link>
        }
      />

      <div className="mb-8 rounded-[14px] border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/50 p-6">
        <div className="flex items-start gap-3">
          <span className="text-[28px]">✨</span>
          <div>
            <h2 className="text-[17px] font-semibold text-foreground">What do you want to do today?</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Announcements open the campaign composer 📣 · Follow-ups and welcome flows become multi-step
              sequences 🔁 · Missed calls and status updates launch smart automations 🤖
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {grouped.map(({ engine, meta, items }) => (
          <section key={engine}>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[20px]">{meta.emoji}</span>
              <h2 className="text-[18px] font-bold text-foreground">{meta.label}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {items.length} playbooks
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((cat) => (
                <PlaybookCard key={cat.id} cat={cat} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 flex items-center gap-3 rounded-[14px] border border-dashed border-border bg-muted/20 px-5 py-4">
        <Sparkles className="h-5 w-5 shrink-0 text-indigo-600" />
        <p className="text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">Pro tip:</span> Start with a playbook, then tweak
          triggers, timing, and copy in the builder. You can always save as draft and come back later.
        </p>
      </div>
    </div>
  );
}
