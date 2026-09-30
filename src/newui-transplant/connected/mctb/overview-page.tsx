"use client";

import Link from "next/link";
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
  Initials,
  Page,
  PageHeader,
  Panel,
  Pill,
  KeyValueRow,
  Stat,
  TextLink,
} from "@/newui-transplant/components/app/kit";
import { MissedCallsCompactTable } from "@/newui-transplant/components/app/opus-tables";
import { mapMctbOverviewRecentMissedCalls } from "@/lib/newui-transplant/adapters/mctb-overview";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { useMctbOverviewEnrichment } from "@/newui-transplant/connected/mctb/overview-enrichment";
import { MctbRecoveryPauseOpus } from "@/newui-transplant/components/mctb/mctb-recovery-pause-opus";
import { fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { openMctbSetupGuide } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
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
  const recentMissed = mapMctbOverviewRecentMissedCalls(data);
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
    <Page>
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
          <p className="text-sm font-medium">Recovered calls this month</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">
              {capabilities.monthlyRecoveriesUsed} / {capabilities.monthlyRecoveryLimit}
            </span>
            {capabilities.monthlyRecoveriesUsed >= capabilities.monthlyRecoveryLimit
              ? " — limit reached; new recovery texts are suppressed until the next period."
              : " — qualifying missed calls count toward your plan limit."}
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
          title={leadRecovery.enabled ? "AI Recovery is on" : "AI Recovery is off"}
          badge={
            leadRecovery.enabled ? (
              <Pill tone="success" dot={false} className="h-auto bg-success/20 text-[oklch(0.82_0.12_158)] ring-0">
                {leadRecovery.statusLabel}
              </Pill>
            ) : (
              <Pill tone="neutral" dot={false} className="ring-0">Off</Pill>
            )
          }
          description={leadRecovery.policySummary}
          action={<TextLink href="/mctb/ai-recovery">Manage</TextLink>}
        />
      </div>

      {leadRecovery.status === "needs_attention" && leadRecovery.attentionReason ? (
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
      leadRecovery.status === "ready" &&
      leadRecovery.policySummary !== "Loading…" &&
      data.kpis.needsReplyCount === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          Nothing needs attention. Forwarding, sender, and consent are healthy.
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel
          title="Recent missed calls"
          action={<TextLink href="/mctb/missed-calls">View all</TextLink>}
          className="lg:col-span-3"
          bodyClassName="p-0"
        >
          <MissedCallsCompactTable rows={recentMissed.slice(0, 5)} />
        </Panel>

        <Panel
          title="Recent conversations"
          action={<TextLink href="/mctb/conversations">Open inbox</TextLink>}
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {data.recentConversations.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/mctb/conversations?conversation=${c.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50">
                  <Initials name={c.label} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{c.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.preview}</span>
                  </div>
                  {c.needsReply ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Needs reply" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title="Setup health" bodyClassName="divide-y p-0 px-5">
        <KeyValueRow label="Business line" value={data.setupHealth.businessLine || "—"} href="/mctb/setup/phone" />
        <KeyValueRow label="Forwarding" value={data.setupHealth.forwardingLabel} href="/mctb/setup/phone" />
        <KeyValueRow label="Consent" value={data.setupHealth.consentLabel} href="/mctb/setup/consent" />
        <KeyValueRow label="Sender" value={data.setupHealth.senderLabel} href="/mctb/setup/phone" />
        <KeyValueRow label="Recovery" value={data.setupHealth.recoveryLabel} href="/mctb/setup/recovery" />
      </Panel>
    </Page>
  );
}
