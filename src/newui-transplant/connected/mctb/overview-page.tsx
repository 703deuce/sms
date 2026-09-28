"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { Initials, Page, PageHeader, Panel, Pill, Rows, Stat, TextLink } from "@/newui-transplant/components/app/kit";
import { RecoveryPill } from "@/newui-transplant/components/app/status";
import { mapMctbOverviewRecentMissedCalls } from "@/lib/newui-transplant/adapters/mctb-overview";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { useMctbOverviewEnrichment } from "@/newui-transplant/connected/mctb/overview-enrichment";
import { MctbRecoveryPauseOpus } from "@/newui-transplant/components/mctb/mctb-recovery-pause-opus";
import { fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { openMctbSetupGuide } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import { Button } from "@/newui-transplant/components/ui/button";

export function NewUiMctbOverviewPage({ data }: { data: MctbOverviewPayload }) {
  const { leadRecovery } = useMctbOverviewEnrichment(data);
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value={String(kpis.missedCallsToday)} hint={kpis.windowLabel} href="/mctb/missed-calls" />
        <Stat label="Recovery texts sent" value={String(kpis.recoveryTextsToday)} hint="Today" href="/mctb/missed-calls" />
        <Stat label="Customer replies" value={String(kpis.repliesToday)} hint="Today" href="/mctb/conversations" />
        <Stat label="Needs reply" value={String(kpis.needsReplyCount)} hint="Waiting on your team" href="/mctb/conversations" />
      </div>

      {capabilities && capabilities.monthlyRecoveryLimit > 0 ? (
        <div className="mt-4 rounded-xl border bg-card px-4 py-3">
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

      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            AI Recovery{" "}
            <Pill tone={leadRecovery.enabled ? "success" : "neutral"}>
              {leadRecovery.enabled ? "On" : "Off"}
            </Pill>
          </p>
          <p className="text-xs text-muted-foreground">{leadRecovery.policySummary}</p>
        </div>
        <TextLink href="/mctb/ai-recovery">Manage</TextLink>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Caller</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Missed</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Recovery</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Reply</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentMissed.slice(0, 5).map((m) => (
                  <tr key={m.id} className="relative hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/mctb/missed-calls/${m.id}`} className="font-medium after:absolute after:inset-0">
                        {m.caller}
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{m.missed}</td>
                    <td className="px-3 py-3"><RecoveryPill status={m.recovery} /></td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-muted-foreground">{m.reply ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <Link href={`/mctb/conversations?conversation=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <Initials name={c.label} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                  </div>
                  {c.needsReply ? <Pill tone="warning">Needs reply</Pill> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title="Setup health">
        <Rows
          items={[
            { label: "Business line", value: data.setupHealth.businessLine || "—", href: "/mctb/setup/phone" },
            { label: "Forwarding", value: data.setupHealth.forwardingLabel, href: "/mctb/setup/phone" },
            { label: "Consent", value: data.setupHealth.consentLabel, href: "/mctb/setup/consent" },
            { label: "Sender", value: data.setupHealth.senderLabel, href: "/mctb/setup/phone" },
            { label: "Recovery", value: data.setupHealth.recoveryLabel, href: "/mctb/setup/recovery" },
          ]}
        />
      </Panel>
    </Page>
  );
}
