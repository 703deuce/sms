"use client";

import type { DashboardDateRange } from "@/lib/outcomes/operational-dashboard-types";
import { ProductCrossSellBanner } from "@/components/products/product-cross-sell-banner";
import { cn } from "@/lib/utils";
import type { WorkspaceFeatureSnapshot } from "@/lib/products/feature-entitlements";
import {
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  PhoneMissed,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardProps = {
  userName: string;
  range: DashboardDateRange;
  productFeatures?: WorkspaceFeatureSnapshot | null;
};

type SetupSummary = {
  compliance: { messagingReady: boolean; requiredActions: string[] };
  runtime: { enabled: boolean; phoneNumberId: string | null };
};

type MissedSummary = {
  missedToday: number;
  sentToday: number;
  repliedToday: number;
};

type ActivityItem = {
  id: string;
  type: string;
  label: string;
  at: string;
  href?: string;
};

type DashboardCard = {
  product: string;
  title: string;
  href: string;
  metrics: Array<{ label: string; value: number | string }>;
};

type DashboardSummary = {
  features: WorkspaceFeatureSnapshot;
  cards: DashboardCard[];
  summary: {
    missed30d: number;
    linkClicks30d: number;
    formSubmissions30d: number;
  };
};

export function MctbDashboardView({
  userName,
  range,
  productFeatures = null,
}: DashboardProps) {
  const [setup, setSetup] = useState<SetupSummary | null>(null);
  const [missed, setMissed] = useState<MissedSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const features: WorkspaceFeatureSnapshot = productFeatures ?? summary?.features ?? {
    mctb: "inactive",
    smart_routing: "inactive",
    visual_voicemail: "inactive",
    callback_requests: "inactive",
  };

  useEffect(() => {
    fetch("/api/mctb/setup", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || !j.data) return;
        setSetup({
          compliance: j.data.compliance,
          runtime: {
            enabled: j.data.runtime.enabled,
            phoneNumberId: j.data.runtime.phoneNumberId,
          },
        });
      })
      .catch(() => undefined);
    fetch("/api/mctb/missed-calls?limit=1", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) return;
        setMissed(j.data?.summary || null);
      })
      .catch(() => undefined);
    fetch("/api/platform/activity?limit=12", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) return;
        setActivity(j.data || []);
      })
      .catch(() => undefined);
    fetch("/api/platform/dashboard-summary", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) return;
        setSummary(j.data || null);
      })
      .catch(() => undefined);
  }, []);

  const needsCompliance = setup && !setup.compliance.messagingReady;
  const needsSetup = setup && !setup.runtime.phoneNumberId;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
          Good {range === "today" ? "day" : "morning"}, {userName.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your inbound call platform — missed call recovery, routing, and activity at a glance.
        </p>
      </div>

      <ProductCrossSellBanner
        feature="smart_routing"
        features={features}
        title="Route callers before they become a missed call"
        description="Add Smart Routing to your existing business number — professional menu and call routing without replacing your phones."
        cta="Try Smart Routing"
        href="/settings/billing"
      />

      {needsCompliance ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">Messaging setup incomplete</p>
              <p className="mt-0.5 text-[13px] text-amber-900">
                Complete verification before missed-call text back can go live.
              </p>
            </div>
          </div>
          <Link
            href="/compliance"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-amber-900 px-4 text-[13px] font-semibold text-white hover:bg-amber-800"
          >
            <ShieldCheck className="h-4 w-4" />
            Messaging Compliance
          </Link>
        </div>
      ) : null}

      {needsSetup ? (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-indigo-950">Finish setup</p>
            <p className="mt-0.5 text-[13px] text-indigo-900">
              Connect your business number and recovery messaging.
            </p>
          </div>
          <Link
            href="/voice/setup"
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#6366f1] px-4 text-[13px] font-semibold text-white"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Open Setup
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Missed today"
          value={missed?.missedToday ?? 0}
          icon={PhoneMissed}
          href="/voice/missed-calls"
        />
        <StatCard
          label="Texts sent today"
          value={missed?.sentToday ?? 0}
          icon={Send}
          href="/voice/missed-calls"
        />
        <StatCard
          label="Replies today"
          value={missed?.repliedToday ?? 0}
          icon={MessageSquare}
          href="/inbox"
        />
        <StatCard
          label="Link clicks (30d)"
          value={summary?.summary.linkClicks30d ?? 0}
          icon={ArrowRight}
          href="/voice/analytics"
        />
      </div>

      {summary?.cards?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {summary.cards.map((card) => (
            <Link
              key={card.product}
              href={card.href}
              className="rounded-xl border border-[#e5e7eb] bg-white p-4 transition hover:border-[#6366f1]/40"
            >
              <h2 className="text-[15px] font-semibold text-[#111827]">{card.title}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {card.metrics.map((metric) => (
                  <div key={metric.label} className="text-[13px]">
                    <span className="text-muted-foreground">{metric.label}</span>
                    <p className="font-semibold tabular-nums">{metric.value}</p>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      {summary ? (
        <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">Platform summary (30 days)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-[13px]">
            <div>
              <span className="text-muted-foreground">Missed calls</span>
              <p className="font-semibold">{summary.summary.missed30d}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Link clicks</span>
              <p className="font-semibold">{summary.summary.linkClicks30d}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Form submissions</span>
              <p className="font-semibold">{summary.summary.formSubmissions30d}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        <h2 className="text-[15px] font-semibold text-[#111827]">Recent activity</h2>
        <ul className="mt-3 space-y-2">
          {activity.map((item) => (
            <li key={item.id} className="flex items-center justify-between text-[13px]">
              {item.href ? (
                <Link href={item.href} className="text-[#374151] hover:text-[#6366f1]">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              <span className="text-muted-foreground text-xs">
                {new Date(item.at).toLocaleString()}
              </span>
            </li>
          ))}
          {!activity.length ? (
            <li className="text-[13px] text-muted-foreground">No recent activity yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border border-[#e5e7eb] bg-white p-4 transition hover:border-[#6366f1]/40",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#111827]">{value}</p>
    </Link>
  );
}
