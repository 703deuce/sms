"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImageIcon, Share2, Sparkles, CalendarCheck } from "lucide-react";
import { vizClientError, vizClientLog, vizFetchJson } from "@/lib/visualizer/client-api";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { ArStatGrid } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";

type OverviewData = {
  metrics: {
    designsCreated: number;
    designsShared: number;
    estimateRequests: number;
    appointmentsScheduled: number;
  };
  recentProjects: Array<{
    id: string;
    name: string;
    statusLabel: string;
    transformationLabel: string;
    contact: { name: string } | null;
    thumbUrl: string | null;
    designCount: number;
  }>;
};

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Sparkles;
}) {
  return (
    <div className={cn(OPUS_CARD, "flex flex-col gap-2 p-4")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" aria-hidden />
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function VisualizerOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    vizClientLog("overview:load-start");
    vizFetchJson<OverviewData & { error?: string }>("overview", "/api/visualizer/overview")
      .then((body) => {
        setData(body);
        vizClientLog("overview:load-ok");
      })
      .catch((e) => {
        vizClientError("overview:load-failed", e);
        setError(e instanceof Error ? e.message : "Error");
      });
  }, []);

  const metrics = data?.metrics;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Visualizer / Overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Bring remodeling ideas to life</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Create realistic bathroom previews using your company&apos;s products.
          </p>
        </div>
        <Button render={<Link href={VISUALIZER_ROUTES.newDesign} />}>Create new design</Button>
      </header>

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      <ArStatGrid>
        <MetricCard label="Designs created" value={metrics?.designsCreated ?? 0} icon={Sparkles} />
        <MetricCard label="Designs shared" value={metrics?.designsShared ?? 0} icon={Share2} />
        <MetricCard label="Estimate requests" value={metrics?.estimateRequests ?? 0} icon={ImageIcon} />
        <MetricCard
          label="Appointments scheduled"
          value={metrics?.appointmentsScheduled ?? 0}
          icon={CalendarCheck}
        />
      </ArStatGrid>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent projects</h2>
          <Button variant="ghost" size="sm" render={<Link href={VISUALIZER_ROUTES.projects} />}>
            View all
          </Button>
        </div>
        {!data?.recentProjects.length ? (
          <div className={cn(OPUS_CARD, "flex flex-col items-center gap-4 p-10 text-center")}>
            <Sparkles className="size-10 text-primary" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold">Start with a bathroom photo</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Upload an existing bathroom and see what it could look like with your shower products.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button render={<Link href={VISUALIZER_ROUTES.newDesign} />}>Create your first design</Button>
              <Button variant="outline" render={<Link href={VISUALIZER_ROUTES.materials} />}>
                Add materials
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentProjects.map((p) => (
              <Link
                key={p.id}
                href={VISUALIZER_ROUTES.project(p.id)}
                className={cn(OPUS_CARD, "group overflow-hidden transition hover:border-primary/40")}
              >
                <div className="relative aspect-[4/3] bg-muted/40">
                  {p.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-8" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <p className="font-medium group-hover:text-primary">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.transformationLabel} · {p.statusLabel}
                    {p.contact ? ` · ${p.contact.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.designCount} design(s)</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
