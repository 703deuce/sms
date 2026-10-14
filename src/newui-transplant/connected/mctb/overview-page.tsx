"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MessageSquareReply,
  MessagesSquare,
  PhoneMissed,
  Send,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import {
  Callout,
  FeatureEmphasisStrip,
  Page,
  PageHeader,
  Panel,
  Pill,
  KeyValueRow,
  Stat,
  TextLink,
} from "@/newui-transplant/components/app/kit";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import { MctbOverviewRecoverySummaries } from "@/newui-transplant/components/mctb/mctb-overview-recovery-summaries";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { useMctbOverviewEnrichment } from "@/newui-transplant/connected/mctb/overview-enrichment";
import { MctbRecoveryPauseOpus } from "@/newui-transplant/components/mctb/mctb-recovery-pause-opus";
import { fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { openMctbSetupGuide } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";

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
  const [timezone, setTimezone] = useState("America/New_York");

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

  return (
    <Page className="pb-24 lg:pb-6">
      <PageHeader
        title="Overview"
        status={
          <Pill tone={data.status === "active" ? "success" : data.status === "paused" ? "warning" : "neutral"}>
            {data.statusLabel}
          </Pill>
        }
        description="Every missed call gets an instant text so the conversation keeps going."
        actions={
          <Button type="button" variant="outline" onClick={() => openMctbSetupGuide()}>
            Setup guide
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Missed calls" value={String(kpis.missedCallsToday)} hint={kpis.windowLabel} href="/mctb/missed-calls" icon={PhoneMissed} />
        <Stat label="Recovery texts sent" value={String(kpis.recoveryTextsToday)} hint="Today" href="/mctb/missed-calls" icon={Send} />
        <Stat label="Customer replies" value={String(kpis.repliesToday)} hint="Today" href="/mctb/conversations" icon={MessageSquareReply} />
        <Stat label="Needs reply" value={String(kpis.needsReplyCount)} hint="Waiting on your team" href="/mctb/conversations?filter=needs_reply" icon={MessagesSquare} />
      </div>

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

      {schedule ? (
        <div className="mt-4">
          <MctbRecoveryPauseOpus
            compact
            paused={schedule.paused}
            pauseUntil={schedule.pauseUntil}
            pauseKind={schedule.pauseKind}
            timezone={timezone}
            onUpdated={() => void reloadSetup()}
          />
        </div>
      ) : null}

      <div className="mt-4">
        <FeatureEmphasisStrip
          icon={Sparkles}
          title="Text-back replies"
          badge={<Pill tone="success" dot={false} className="h-auto bg-success/20 text-[oklch(0.82_0.12_158)] ring-0">Included</Pill>}
          description="Callers get one automatic thank-you after they reply, then your team is notified with their message. No AI chat required."
          action={<TextLink href={MCTB_ROUTES.textBack}>Manage text back</TextLink>}
        />
      </div>

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

      <div className="mt-4">
        <MctbOverviewRecoverySummaries rows={data.recentMissedCalls ?? []} timeZone={timezone} />
      </div>

      <Panel className="mt-4" title="Setup health" bodyClassName="divide-y p-0 px-5">
        <KeyValueRow label="Business line" value={data.setupHealth.businessLine || "—"} href={MCTB_ROUTES.phone} />
        <KeyValueRow label="Forwarding" value={data.setupHealth.forwardingLabel} href={MCTB_ROUTES.phone} />
        <KeyValueRow label="Consent" value={data.setupHealth.consentLabel} href={`${MCTB_ROUTES.missedCallRecovery}?tab=consent`} />
        <KeyValueRow label="Sender" value={data.setupHealth.senderLabel} href={MCTB_ROUTES.phone} />
        <KeyValueRow label="Recovery" value={data.setupHealth.recoveryLabel} href={MCTB_ROUTES.missedCallRecovery} />
      </Panel>
    </Page>
  );
}
