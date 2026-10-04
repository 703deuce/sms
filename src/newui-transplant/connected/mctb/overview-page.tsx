"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  MessageSquareReply,
  MessagesSquare,
  PhoneMissed,
  Send,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import {
  KeyValueRow,
  Page,
  PageHeader,
  Panel,
  Pill,
  Stat,
  TextLink,
} from "@/newui-transplant/components/app/kit";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { useMctbOverviewEnrichment } from "@/newui-transplant/connected/mctb/overview-enrichment";
import { MctbRecoveryPauseOpus } from "@/newui-transplant/components/mctb/mctb-recovery-pause-opus";
import { fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { openMctbSetupGuide } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { MctbOverviewNeedsAttention } from "@/newui-transplant/components/mctb/mctb-overview-needs-attention";
import { MctbOverviewMissedList } from "@/newui-transplant/components/mctb/mctb-overview-missed-list";
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

  const setupHealthy =
    data.setupComplete &&
    data.setupHealth.forwardingLabel === "Verified" &&
    !data.setupHealth.senderLabel.includes("Needs");

  const recoveryUsed = capabilities?.monthlyRecoveriesUsed ?? 0;
  const recoveryLimit = capabilities?.monthlyRecoveryLimit ?? 0;

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

      {schedule?.paused ? (
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

      <MctbOverviewNeedsAttention items={data.needsAttention ?? []} />

      <Panel
        title="Recent missed calls"
        action={<TextLink href="/mctb/missed-calls">View all</TextLink>}
        className="mt-4"
        bodyClassName="p-0"
      >
        <MctbOverviewMissedList rows={data.recentMissedCalls.slice(0, 5)} />
      </Panel>

      <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${OPUS_CARD}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-medium">AI Recovery</span>
          <span className="text-muted-foreground" aria-hidden="true">·</span>
          <Pill tone={leadRecovery.enabled ? "success" : "neutral"} dot={leadRecovery.enabled} className="h-auto py-0.5">
            {leadRecovery.enabled ? "On" : "Off"}
          </Pill>
          {recoveryLimit > 0 ? (
            <>
              <span className="text-muted-foreground" aria-hidden="true">·</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {recoveryUsed} / {recoveryLimit} recoveries
              </span>
            </>
          ) : null}
        </div>
        <TextLink href="/mctb/ai-recovery">Manage</TextLink>
      </div>

      {setupHealthy ? (
        <details className={cn("mt-4 group", OPUS_CARD)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
              <span className="font-medium">Setup complete</span>
              <span className="text-muted-foreground">
                Forwarding verified · Sender ready · Recovery active
              </span>
            </span>
            <span className="flex items-center gap-2 text-primary">
              <Link href="/mctb/setup" className="text-xs font-medium hover:underline">View setup</Link>
              <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <div className="divide-y border-t px-5">
            <KeyValueRow label="Business line" value={data.setupHealth.businessLine || "—"} href="/mctb/setup/phone" />
            <KeyValueRow label="Forwarding" value={data.setupHealth.forwardingLabel} href="/mctb/setup/phone" />
            <KeyValueRow label="Consent" value={data.setupHealth.consentLabel} href="/mctb/setup/consent" />
            <KeyValueRow label="Sender" value={data.setupHealth.senderLabel} href="/mctb/setup/phone" />
            <KeyValueRow label="Recovery" value={data.setupHealth.recoveryLabel} href="/mctb/setup/recovery" />
          </div>
        </details>
      ) : (
        <Panel className="mt-4" title="Setup health" bodyClassName="divide-y p-0 px-5">
          <KeyValueRow label="Business line" value={data.setupHealth.businessLine || "—"} href="/mctb/setup/phone" />
          <KeyValueRow label="Forwarding" value={data.setupHealth.forwardingLabel} href="/mctb/setup/phone" />
          <KeyValueRow label="Consent" value={data.setupHealth.consentLabel} href="/mctb/setup/consent" />
          <KeyValueRow label="Sender" value={data.setupHealth.senderLabel} href="/mctb/setup/phone" />
          <KeyValueRow label="Recovery" value={data.setupHealth.recoveryLabel} href="/mctb/setup/recovery" />
          {!data.setupComplete ? (
            <div className="py-4">
              <ButtonLink href="/mctb/setup">Finish setup</ButtonLink>
            </div>
          ) : null}
        </Panel>
      )}
    </Page>
  );
}
