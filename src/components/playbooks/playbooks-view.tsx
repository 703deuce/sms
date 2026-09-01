"use client";

import { CATEGORY_ICONS } from "@/components/campaigns/category-icons";
import { Button } from "@/components/ui/button";
import { V1PageHeader } from "@/components/v1/v1-polish";
import { CAMPAIGN_CATEGORIES, type CampaignCategory } from "@/lib/campaigns/catalog";
import { playbookHref } from "@/lib/campaigns/playbook-routes";
import { ENGINE_LABELS, PLAYBOOK_EMOJIS } from "@/lib/v1/playbook-emojis";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight, LayoutList, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

const ENGINE_ORDER: CampaignCategory["engine"][] = ["broadcast", "sequence", "automation"];

const ENGINE_DESCRIPTIONS: Record<CampaignCategory["engine"], string> = {
  broadcast: "Send one message to many people — right away or on a schedule.",
  sequence: "Timed, multi-step follow-ups that stop when a contact replies or converts.",
  automation: "Event-driven replies and updates that run themselves around the clock.",
};

function PlaybookCard({ cat }: { cat: CampaignCategory }) {
  const Icon = CATEGORY_ICONS[cat.icon] || LayoutList;
  const emoji = PLAYBOOK_EMOJIS[cat.id];
  const engine = ENGINE_LABELS[cat.engine];

  return (
    <Link
      href={playbookHref(cat)}
      className="group relative flex h-full flex-col rounded-xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_8px_20px_-8px_rgba(79,70,229,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="relative shrink-0">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[10px] ring-1 ring-inset ring-black/[0.06] transition-transform duration-200 group-hover:scale-105",
                cat.tone,
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            {emoji ? (
              <span className="absolute -right-1.5 -top-1.5 text-[12px] leading-none drop-shadow-sm">
                {emoji}
              </span>
            ) : null}
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground transition-colors duration-150 group-hover:text-primary">
              {cat.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {cat.description}
            </p>
          </div>
        </div>
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-transparent text-muted-foreground/35 transition-all duration-200 group-hover:bg-primary/10 group-hover:text-primary">
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>

      <div className="mt-auto pt-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border/60 pt-3.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-[3px] text-[11px] font-medium leading-none text-muted-foreground ring-1 ring-inset ring-border/40">
            <span aria-hidden>{engine.emoji}</span>
            {engine.label}
          </span>
          <span className="truncate text-[11px] text-muted-foreground/70">
            e.g. {cat.examples.slice(0, 2).join(" · ")}
          </span>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary/90 transition-colors duration-150 group-hover:text-primary">
          {cat.cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
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
    <div className="mx-auto max-w-[1200px] px-1 pb-12">
      <V1PageHeader
        emoji="📚"
        title="Playbooks"
        description="Pick what you want to accomplish — we'll route you to the right campaign, sequence, or automation builder. Every card is a ready-made starting point."
        actions={
          <Link href="/campaigns">
            <Button variant="outline" size="md">
              <LayoutList className="h-4 w-4" />
              View campaigns
            </Button>
          </Link>
        }
      />

      <div className="mb-10 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-violet-50/50 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-[17px] shadow-sm ring-1 ring-border/60">
            ✨
          </span>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
              What do you want to do today?
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Announcements open the campaign composer · follow-ups and welcome flows become
              multi-step sequences · missed calls and status updates launch smart automations.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {grouped.map(({ engine, meta, items }) => (
          <section key={engine}>
            <div className="mb-4 flex flex-wrap items-end gap-x-2.5 gap-y-1 border-b border-border/60 pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/70 text-[14px] leading-none ring-1 ring-inset ring-border/40">
                {meta.emoji}
              </span>
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                {meta.label}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-[2px] text-[11px] font-semibold tabular-nums leading-none text-primary ring-1 ring-inset ring-primary/15">
                {items.length}
              </span>
              <p className="hidden text-[12px] leading-relaxed text-muted-foreground md:ml-auto md:block">
                {ENGINE_DESCRIPTIONS[engine]}
              </p>
              <p className="basis-full text-[12px] leading-relaxed text-muted-foreground md:hidden">
                {ENGINE_DESCRIPTIONS[engine]}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((cat) => (
                <PlaybookCard key={cat.id} cat={cat} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 flex items-start gap-3.5 rounded-xl border border-dashed border-border bg-muted/25 px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Pro tip:</span> Start with a playbook,
          then tweak triggers, timing, and copy in the builder. You can always save as draft and
          come back later.
        </p>
      </div>
    </div>
  );
}
