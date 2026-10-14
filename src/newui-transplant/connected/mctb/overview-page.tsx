"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  ArOpusPage,
  OpusDataSurface,
} from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { Button } from "@/newui-transplant/components/ui/button";
import {
  Callout,
  PageHeader,
  Pill,
  TextLink,
} from "@/newui-transplant/components/app/kit";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { useMctbOverviewEnrichment } from "@/newui-transplant/connected/mctb/overview-enrichment";
import { fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { openMctbSetupGuide } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { MctbOverviewAgendaView } from "@/newui-transplant/components/mctb/mctb-overview-agenda-view";
import { MctbOverviewSidePanel } from "@/newui-transplant/components/mctb/mctb-overview-side-panel";
import { MctbOverviewLowerStrip } from "@/newui-transplant/components/mctb/mctb-overview-lower-strip";
import { cn } from "@/lib/utils";

export function NewUiMctbOverviewPage({ data }: { data: MctbOverviewPayload }) {
  const { leadRecovery: leadRecoveryRaw } = useMctbOverviewEnrichment(data);
  const leadRecovery = leadRecoveryRaw ?? data.leadRecovery ?? {
    enabled: false,
    activePolicyCount: 0,
    status: "disabled" as const,
    statusLabel: "Off",
    policySummary: "AI Recovery is not configured.",
    attentionReason: null,
    attentionHref: null,
  };
  const kpis = data.kpis;
  const [capabilities, setCapabilities] = useState<MctbCapabilities | null>(null);
  const [schedule, setSchedule] = useState<{
    paused: boolean;
    pauseUntil: string | null;
    pauseKind: "manual" | "timed" | null;
  } | null>(null);
  const [timezone, setTimezone] = useState(kpis.timeZone || "America/New_York");

  const reloadSetup = useCallback(async () => {
    try {
      const setup = await fetchMctbSetup({ force: true });
      const caps = setup.capabilities as MctbCapabilities | undefined;
      if (caps) setCapabilities(caps);
      const sch = setup.schedule as {
        paused?: boolean;
        pauseUntil?: string | null;
        pauseKind?: "manual" | "timed" | null;
      };
      setSchedule({
        paused: Boolean(sch?.paused ?? data.status === "paused"),
        pauseUntil: sch?.pauseUntil ?? data.pausedUntil,
        pauseKind: sch?.pauseKind ?? null,
      });
      const runtime = setup.runtime as { timezone?: string };
      if (runtime?.timezone) setTimezone(runtime.timezone);
    } catch {
      setSchedule({
        paused: data.status === "paused",
        pauseUntil: data.pausedUntil,
        pauseKind: null,
      });
    }
  }, [data.pausedUntil, data.status]);

  useEffect(() => {
    void reloadSetup();
  }, [reloadSetup]);

  useEffect(() => {
    const onSetup = () => {
      void reloadSetup();
    };
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [reloadSetup]);

  const todayHeading = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });

  return (
    <ArOpusPage wide className="flex flex-col pb-24 lg:min-h-0 lg:pb-6">
      <PageHeader
        title="Overview"
        status={
          <Pill tone={data.status === "active" ? "success" : data.status === "paused" ? "warning" : "neutral"}>
            {data.statusLabel}
          </Pill>
        }
        description="Missed-call recovery workspace — activity, attention, and setup health in one place."
        actions={
          <Button type="button" variant="outline" onClick={() => openMctbSetupGuide()}>
            Setup guide
          </Button>
        }
      />

      {capabilities && capabilities.monthlyRecoveryLimit > 0 ? (
        <div className={`mt-4 px-4 py-3 ${OPUS_CARD}`}>
          <p className="text-sm font-medium">Recovery texts this month</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">
              {capabilities.monthlyRecoveriesUsed} / {capabilities.monthlyRecoveryLimit}
            </span>
            {capabilities.monthlyRecoveriesUsed >= capabilities.monthlyRecoveryLimit
              ? " — limit reached; new recovery texts are suppressed until the next period."
              : " — each missed call we text back counts once. Customer replies are not counted."}
          </p>
        </div>
      ) : null}

      {capabilities?.aiRecoveryEntitled &&
      leadRecovery.status === "needs_attention" &&
      leadRecovery.attentionReason ? (
        <div className="mt-3">
          <Callout
            tone="warning"
            icon={AlertTriangle}
            title={leadRecovery.attentionReason}
            action={
              leadRecovery.attentionHref ? (
                <TextLink href={leadRecovery.attentionHref}>Review</TextLink>
              ) : undefined
            }
          />
        </div>
      ) : null}

      {data.status === "active" &&
      data.setupComplete &&
      (!capabilities?.aiRecoveryEntitled || leadRecovery.status === "ready") &&
      leadRecovery.policySummary !== "Loading…" &&
      data.kpis.needsReplyCount === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          Nothing needs attention. Forwarding, sender, and consent are healthy.
        </div>
      ) : null}

      <div
        className={cn(
          "mt-4 flex min-h-0 flex-col gap-3 lg:grid lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:gap-4",
        )}
      >
        <div className="flex min-w-0 flex-col lg:min-h-[min(32rem,70vh)]">
          <OpusDataSurface
            className="flex max-lg:flex-none flex-col overflow-hidden lg:min-h-0 lg:flex-1"
            toolbar={
              <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Recovery activity
                  </p>
                  <p className="text-sm font-semibold text-foreground">Missed call agenda</p>
                  <p className="text-[11px] text-muted-foreground">{todayHeading}</p>
                </div>
                <TextLink href={MCTB_ROUTES.missedCalls}>View all missed calls</TextLink>
              </div>
            }
          >
            <div className="min-h-[280px] p-2 md:p-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
              <MctbOverviewAgendaView
                rows={data.recentMissedCalls ?? []}
                timeZone={timezone}
              />
            </div>
          </OpusDataSurface>
        </div>

        <MctbOverviewSidePanel
          className="max-lg:shrink-0 lg:min-h-[min(32rem,70vh)]"
          data={data}
          schedule={schedule}
          timezone={timezone}
          onScheduleUpdated={() => void reloadSetup()}
        />
      </div>

      <MctbOverviewLowerStrip data={data} />
    </ArOpusPage>
  );
}
