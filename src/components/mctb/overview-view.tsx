"use client";

import { Button } from "@/components/ui/button";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { MCTB_LAUNCH_COMPACT_OVERVIEW } from "@/lib/mctb/launch-flags";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CallHandlingDashboardCard } from "@/components/call-handling/call-handling-switcher";
import {
  MctbHomeAiRecoverySummary,
  MctbHomeAttentionOkStrip,
  MctbHomeKpiStrip,
  MctbHomeNeedsAttention,
  MctbHomeRecentActivity,
  MctbHomeRecentConversations,
  MctbHomeRecentMissedCallsTable,
  MctbHomeSetupStatus,
  buildMctbAttentionItems,
  statusChip,
} from "@/components/mctb/home/mctb-home-sections";
import "./home/mctb-home.css";

type MctbOverviewViewProps = {
  initialData?: MctbOverviewPayload | null;
};

function headerCta(data: MctbOverviewPayload) {
  if (data.status === "setup_incomplete") return { href: MCTB_ROUTES.setup, label: "Finish setup" };
  if (data.status === "paused") return { href: MCTB_ROUTES.setupRecovery, label: "Resume now" };
  if (data.status === "messaging_blocked") return { href: MCTB_ROUTES.setup, label: "Fix messaging" };
  if (MCTB_LAUNCH_COMPACT_OVERVIEW && data.status === "active") return null;
  return { href: MCTB_ROUTES.setup, label: "Manage setup" };
}

export function MctbOverviewView({ initialData = null }: MctbOverviewViewProps) {
  const [data, setData] = useState<MctbOverviewPayload | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/mctb/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error("load failed");
      setData(json.data);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError(false);
      return;
    }
    void load();
  }, [initialData, load]);

  const attentionItems = useMemo(() => (data ? buildMctbAttentionItems(data) : []), [data]);
  const cta = data ? headerCta(data) : null;
  const hasAttention = attentionItems.length > 0;
  const compact = MCTB_LAUNCH_COMPACT_OVERVIEW;

  if (loading) {
    return (
      <div className="mctb-home transovo-product-surface-first" aria-busy="true" aria-label="Loading overview">
        <div className="mctb-home-inner animate-pulse space-y-4">
          <div className="h-8 w-72 rounded bg-[#e5e8eb]" />
          <div className="mctb-home-kpi-strip">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mctb-home-kpi">
                <div className="h-8 w-8 rounded-lg bg-[#eef0f2]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 rounded bg-[#eef0f2]" />
                  <div className="h-6 w-12 rounded bg-[#eef0f2]" />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="mctb-home-surface h-48 lg:col-span-8" />
            <div className="mctb-home-surface h-32 lg:col-span-4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mctb-home transovo-product-surface-first">
        <div className="mctb-home-inner">
          <div className="mctb-home-surface px-6 py-10 text-center">
            <p className="text-[15px] font-medium text-[#1b1e23]">Overview couldn&apos;t be loaded.</p>
            <Button
              type="button"
              size="sm"
              className="mt-4 bg-[#1b1e23] text-white hover:bg-[#262a31]"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel =
    data.status === "active"
      ? "Active"
      : data.status === "paused"
        ? "Paused"
        : data.status === "messaging_blocked"
          ? "Needs attention"
          : "Setup incomplete";

  return (
    <div className="mctb-home transovo-product-surface-first">
      <div className="mctb-home-inner space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="mctb-home-page-title text-2xl font-semibold leading-[30px] tracking-[-0.02em]">
                Overview
              </h1>
              {statusChip(data.status, statusLabel)}
            </div>
            <p className="mctb-home-page-subtitle mt-1 text-sm leading-5">
              {compact
                ? "What’s happening with missed-call recovery right now."
                : "Missed-call recovery activity, replies, and setup health."}
            </p>
          </div>
          {cta ? (
            <Link
              href={cta.href}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#dee2e6] bg-white px-4 text-[13px] font-medium text-[#1b1e23] hover:bg-[#fafbfc]"
            >
              {cta.label}
            </Link>
          ) : null}
        </header>

        {!data.setupComplete ? (
          <p className="mctb-home-banner-warn rounded-lg px-3 py-2 text-[13px]" role="status">
            Setup is not complete — finish forwarding and messaging to recover missed calls reliably.{" "}
            <Link href={MCTB_ROUTES.setupStart} className="font-semibold underline">
              Continue setup
            </Link>
          </p>
        ) : null}

        {!compact ? <CallHandlingDashboardCard /> : null}

        <MctbHomeKpiStrip data={data} />

        <MctbHomeAiRecoverySummary data={data} />

        {compact ? (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-3">
            {hasAttention ? (
              <div className="lg:col-span-4">
                <MctbHomeNeedsAttention items={attentionItems} />
              </div>
            ) : (
              <div className="lg:col-span-12">
                <MctbHomeAttentionOkStrip />
              </div>
            )}
            <div className={hasAttention ? "lg:col-span-8" : "lg:col-span-12"}>
              <MctbHomeRecentActivity data={data} />
            </div>
            <MctbHomeSetupStatus data={data} />
          </div>
        ) : (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-3">
            {hasAttention ? (
              <div className="order-1 lg:hidden">
                <MctbHomeNeedsAttention items={attentionItems} />
              </div>
            ) : null}

            <div
              className={
                hasAttention
                  ? "order-2 lg:order-1 lg:col-span-8"
                  : "order-2 lg:order-1 lg:col-span-12"
              }
            >
              <MctbHomeRecentMissedCallsTable data={data} attentionOkInline={!hasAttention} />
            </div>

            {hasAttention ? (
              <div className="order-3 hidden lg:order-1 lg:col-span-4 lg:block">
                <MctbHomeNeedsAttention items={attentionItems} />
              </div>
            ) : null}

            <div className="mctb-home-bottom-pair order-4 lg:col-span-12 lg:row-start-2">
              <MctbHomeRecentConversations data={data} />
              <MctbHomeSetupStatus data={data} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
