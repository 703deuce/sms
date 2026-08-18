"use client";

import type { PersonalUsageSummary, PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_USAGE_AVERAGES,
  WIREFRAME_USAGE_BY_NUMBER,
  WIREFRAME_USAGE_HISTORY,
  WIREFRAME_USAGE_SMART_ROUTING,
  WIREFRAME_USAGE_SUMMARY,
  WIREFRAME_USAGE_TREND_CALLS,
  WIREFRAME_USAGE_TREND_FORWARDED,
  WIREFRAME_USAGE_TREND_LABELS,
  WIREFRAME_USAGE_VOICEMAIL,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Mic,
  MoreVertical,
  Phone,
  Settings,
  TrendingUp,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PersonalMockLineChart,
  PersonalMockProgress,
  PersonalMockSparkline,
} from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
  PersonalMockToggle,
  pm,
} from "./mockup/primitives";
import { PersonalNumberSelector } from "./personal-number-selector";

function deriveSparkline(total: number, points = 7): number[] {
  if (total === 0) return Array(points).fill(0);
  const avg = total / points;
  return Array.from({ length: points }, (_, i) =>
    Math.max(0, Math.round(avg * (0.6 + Math.sin(i) * 0.2 + 0.2))),
  );
}

function deriveTrendSeries(used: number, daysInPeriod: number): number[] {
  const labels = Math.min(daysInPeriod, 30);
  return deriveSparkline(used, labels);
}

export function PersonalUsageClient({ numbers }: { numbers: PersonalNumberRow[] }) {
  const searchParams = useSearchParams();
  const numberFilter = searchParams.get("numberId") || "";
  const [usage, setUsage] = useState<PersonalUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendGranularity, setTrendGranularity] = useState("Daily");
  const [alert50, setAlert50] = useState(true);
  const [alert75, setAlert75] = useState(true);
  const [alert90, setAlert90] = useState(true);
  const [alert100, setAlert100] = useState(true);
  const [allowOverage, setAllowOverage] = useState(true);

  useEffect(() => {
    fetch("/api/personal/usage")
      .then((r) => r.json())
      .then((j) => {
        setUsage(j.data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const useWireframe = usePersonalWireframe(usage?.forwardingMinutesUsed ?? 0, 50);
  const showWireframe = loading || !usage || useWireframe;
  const wf = WIREFRAME_USAGE_SUMMARY;

  const periodDays = useMemo(() => {
    if (showWireframe) return 31;
    if (!usage) return 30;
    const start = new Date(usage.billingPeriodStart);
    const end = new Date(usage.billingPeriodEnd);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }, [showWireframe, usage]);

  const daysElapsed = useMemo(() => {
    if (showWireframe) return 14;
    if (!usage) return 1;
    const start = new Date(usage.billingPeriodStart);
    const now = new Date();
    return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }, [showWireframe, usage]);

  const projectedMinutes = useMemo(() => {
    if (showWireframe) return wf.projectedMinutes;
    if (!usage || daysElapsed === 0) return 0;
    return Math.round((usage.forwardingMinutesUsed / daysElapsed) * periodDays);
  }, [showWireframe, usage, daysElapsed, periodDays, wf.projectedMinutes]);

  const trendSeries = useMemo(() => {
    if (showWireframe) return WIREFRAME_USAGE_TREND_FORWARDED;
    if (!usage) return [];
    return deriveTrendSeries(usage.forwardingMinutesUsed, daysElapsed);
  }, [showWireframe, usage, daysElapsed]);

  const callsTrendSeries = useMemo(() => {
    if (showWireframe) return WIREFRAME_USAGE_TREND_CALLS;
    if (!usage) return [];
    return deriveTrendSeries(Math.round(usage.forwardingMinutesUsed * 1.2), daysElapsed);
  }, [showWireframe, usage, daysElapsed]);

  const trendLabels = useMemo(() => {
    if (showWireframe) return WIREFRAME_USAGE_TREND_LABELS;
    return trendSeries.map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (trendSeries.length - 1 - i));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
  }, [showWireframe, trendSeries]);

  const forwardingUsed = showWireframe ? wf.forwardingUsed : usage?.forwardingMinutesUsed ?? 0;
  const forwardingLimit = showWireframe ? wf.forwardingLimit : usage?.forwardingMinutesLimit ?? 600;
  const forwardingRemaining = showWireframe
    ? wf.remaining
    : usage?.forwardingMinutesRemaining ?? 0;
  const pct = Math.min(100, Math.round((forwardingUsed / forwardingLimit) * 100));

  const totalCallsEstimate = showWireframe
    ? wf.calls
    : Math.round((usage?.forwardingMinutesUsed ?? 0) * 1.2);

  const filteredNumbers = useMemo(() => {
    if (showWireframe) return WIREFRAME_USAGE_BY_NUMBER;
    if (!usage) return [];
    return numbers
      .filter((n) => !numberFilter || n.id === numberFilter)
      .map((n) => {
        const row = usage.perNumber.find((p) => p.numberId === n.id);
        const mins = row?.forwardingMinutes ?? 0;
        return {
          number: n.number,
          friendlyName: n.friendlyName || formatPhone(n.number),
          calls: Math.round(mins * 1.2),
          forwarded: mins,
          vm: Math.round(mins * 0.1),
          transcribe: Math.round(mins * 0.08),
          pct: Math.round((mins / Math.max(usage.forwardingMinutesUsed, 1)) * 100),
          trend: deriveSparkline(mins),
        };
      });
  }, [showWireframe, numbers, usage, numberFilter]);

  const sidebar = (
    <>
      <div className={pm.card + " p-4"}>
        <p className="text-[13px] font-semibold text-[#111827]">
          {showWireframe
            ? `${wf.periodStart} – ${wf.periodEnd}`
            : usage
              ? `${new Date(usage.billingPeriodStart).toLocaleDateString()} – ${new Date(usage.billingPeriodEnd).toLocaleDateString()}`
              : "—"}
        </p>
        <p className="mt-1 text-[12px] font-semibold text-[#2563eb]">
          {showWireframe
            ? `${wf.daysRemaining} days remaining`
            : `${periodDays - daysElapsed} days remaining`}
        </p>
      </div>

      <div className="rounded-xl border border-[#c4b5fd] bg-[#7c3aed] p-4 text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          <h3 className="text-[13px] font-semibold">Current Plan</h3>
        </div>
        <p className="mt-3 text-[18px] font-bold">
          {showWireframe ? wf.planName : "Personal"}
        </p>
        <ul className="mt-3 space-y-1.5 text-[12px] text-white/90">
          <li>
            Forwarding Minutes:{" "}
            {showWireframe ? wf.forwardingAllowance : `${forwardingLimit} min`}
          </li>
          <li>
            Transcription Allowance:{" "}
            {showWireframe ? wf.transcriptionAllowance : "100 min"}
          </li>
          <li>
            Vault Limit: {showWireframe ? wf.vaultLimit : "5 numbers"}
          </li>
          <li>
            Plan Price: {showWireframe ? wf.planPrice : "—"}
          </li>
        </ul>
        <PersonalMockBtn
          variant="outline"
          className="mt-4 w-full border-white/30 bg-white text-[#7c3aed] hover:bg-white/90"
        >
          Manage Plan
        </PersonalMockBtn>
      </div>

      <div className={pm.card + " p-4 space-y-3"}>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#6366f1]" />
          <h3 className="text-[13px] font-semibold text-[#111827]">Usage Alerts</h3>
        </div>
        <PersonalMockToggle label="50% of allowance" checked={alert50} onChange={setAlert50} />
        <PersonalMockToggle label="75% of allowance" checked={alert75} onChange={setAlert75} />
        <PersonalMockToggle label="90% of allowance" checked={alert90} onChange={setAlert90} />
        <PersonalMockToggle label="100% of allowance" checked={alert100} onChange={setAlert100} />
        <button type="button" className="text-[12px] font-semibold text-[#2563eb]">
          Manage Alerts
        </button>
      </div>

      <div className={pm.card + " p-4 space-y-3"}>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-[#6366f1]" />
          <h3 className="text-[13px] font-semibold text-[#111827]">Overage Controls</h3>
        </div>
        <PersonalMockToggle label="Allow Overage" checked={allowOverage} onChange={setAllowOverage} />
        <p className="text-[12px] text-[#6b7280]">
          Overage Rate: {showWireframe ? wf.overageRate : "$0.02 / minute"}
        </p>
        <button type="button" className="text-[12px] font-semibold text-[#2563eb]">
          View Overage History
        </button>
      </div>

      <div className="rounded-xl border border-[#bbf7d0] bg-[#ecfdf5] p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#059669]" />
          <h3 className="text-[13px] font-semibold text-[#111827]">Period Status</h3>
        </div>
        <p className="mt-3 text-[14px] font-semibold text-[#059669]">On track</p>
        <p className="text-[12px] text-[#047857]">You&apos;re within your plan limits.</p>
        <div className="mt-3 space-y-1 text-[12px] text-[#6b7280]">
          <p>
            Estimated Overage:{" "}
            <span className="font-semibold text-[#111827]">
              {showWireframe ? wf.estimatedOverage : usage?.estimatedOverageMinutes ?? 0}
            </span>
          </p>
          <p>
            Days Remaining:{" "}
            <span className="font-semibold text-[#111827]">
              {showWireframe ? `${wf.daysRemaining} days` : `${periodDays - daysElapsed} days`}
            </span>
          </p>
        </div>
        <button type="button" className="mt-3 text-[12px] font-semibold text-[#2563eb]">
          View Recommendations
        </button>
      </div>
    </>
  );

  if (loading && !showWireframe) {
    return (
      <PersonalMockPage>
        <p className={pm.muted}>Loading usage…</p>
      </PersonalMockPage>
    );
  }

  const vmStats = showWireframe ? WIREFRAME_USAGE_VOICEMAIL : {
    voicemails: Math.round(forwardingUsed * 0.15),
    vmMinutes: Math.round(forwardingUsed * 0.07),
    transcribed: Math.round(forwardingUsed * 0.12),
    storageMb: Math.round(forwardingUsed * 0.1),
  };

  const smartRouting = showWireframe
    ? WIREFRAME_USAGE_SMART_ROUTING
    : {
        callsThrough: totalCallsEstimate,
        routedMinutes: Math.round(forwardingUsed * 0.35),
        menuInteractions: Math.round(totalCallsEstimate * 2.4),
        vmFallbacks: Math.round(totalCallsEstimate * 0.08),
      };

  const averages = showWireframe
    ? WIREFRAME_USAGE_AVERAGES
    : {
        callsPerDay: Math.round(totalCallsEstimate / daysElapsed),
        forwardedMinPerDay: Math.round(forwardingUsed / daysElapsed),
        avgCallLength:
          totalCallsEstimate > 0
            ? `${Math.floor(forwardingUsed / totalCallsEstimate)}m ${Math.round(
                ((forwardingUsed / totalCallsEstimate) * 60) % 60,
              )}s`
            : "—",
        avgVoicemailLength: "0:39",
      };

  return (
    <PersonalMockPage right={sidebar}>
      <PersonalMockHeader
        title="Usage"
        description="Track call minutes, voicemail usage, storage, and plan limits across your numbers."
        actions={
          <>
            <PersonalNumberSelector
              numbers={numbers}
              selectedId={numberFilter || undefined}
              allowAll
              label=""
            />
            <PersonalMockSelect className="min-w-[180px]" defaultValue="current">
              <option value="current">Current Billing Period</option>
            </PersonalMockSelect>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <PersonalMockKpi
          label="Forwarding Minutes"
          value={
            showWireframe
              ? `${wf.forwardingUsed} / ${wf.forwardingLimit.toLocaleString()}`
              : `${forwardingUsed}`
          }
          sub={showWireframe ? `${wf.pctUsed}% used` : `of ${forwardingLimit}`}
          icon={Clock}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalMockKpi
          label="Calls"
          value={totalCallsEstimate}
          sub="This billing period"
          icon={Phone}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Voicemail Minutes"
          value={showWireframe ? `${wf.vmMinutes} min` : `${vmStats.vmMinutes} min`}
          sub="This billing period"
          icon={Voicemail}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Transcription Minutes"
          value={
            showWireframe ? `${wf.transcribeMinutes} min` : `${Math.round(forwardingUsed * 0.08)} min`
          }
          sub="This billing period"
          icon={Mic}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Estimated Overage"
          value={showWireframe ? wf.estimatedOverage : `$${usage?.estimatedOverageMinutes ?? 0}`}
          sub={showWireframe ? "No overage expected" : "minutes"}
          icon={DollarSign}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection title="Plan Usage" className="lg:col-span-2">
          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <div>
              <p className="text-[28px] font-bold text-[#111827]">
                {forwardingUsed} / {forwardingLimit.toLocaleString()} minutes
              </p>
              <PersonalMockProgress
                className="mt-3"
                value={forwardingUsed}
                max={forwardingLimit}
                label="Forwarding minutes"
              />
              <p className="mt-2 text-[12px] text-[#6b7280]">
                {pct}% of monthly allowance · {forwardingRemaining} remaining
              </p>
              {showWireframe ? (
                <p className="mt-1 text-[11px] font-semibold text-[#059669]">
                  ↑ {wf.trendVsLastMonth}% vs this point last month
                </p>
              ) : null}
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
                <p className="text-[12px] font-semibold text-[#6b7280]">Projected by End of Period</p>
                <p className="mt-1 text-[22px] font-bold text-[#111827]">
                  {projectedMinutes} minutes
                </p>
                <div className="mt-2">
                  <PersonalMockPill tone="green">Within plan</PersonalMockPill>
                </div>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
                <p className="text-[12px] font-semibold text-[#6b7280]">Projected Overage</p>
                <p className="mt-1 text-[22px] font-bold text-[#111827]">
                  {showWireframe ? wf.projectedOverage : "$0.00"}
                </p>
                <p className="mt-1 text-[12px] text-[#6b7280]">No overage expected</p>
              </div>
            </div>
          </div>
        </PersonalMockSection>

        <PersonalMockSection title="Averages">
          <ul className="space-y-4 text-[13px]">
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#6b7280]">
                <Phone className="h-4 w-4 text-[#2563eb]" />
                Average Calls / Day
              </span>
              <span className="font-semibold text-[#111827]">{averages.callsPerDay}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#6b7280]">
                <Clock className="h-4 w-4 text-[#2563eb]" />
                Average Forwarded Min / Day
              </span>
              <span className="font-semibold text-[#111827]">
                {averages.forwardedMinPerDay}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#6b7280]">
                <TrendingUp className="h-4 w-4 text-[#059669]" />
                Average Call Length
              </span>
              <span className="font-semibold text-[#111827]">{averages.avgCallLength}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#6b7280]">
                <Voicemail className="h-4 w-4 text-[#7c3aed]" />
                Average Voicemail Length
              </span>
              <span className="font-semibold text-[#111827]">
                {averages.avgVoicemailLength}
              </span>
            </li>
          </ul>
        </PersonalMockSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection
          title="Usage Trend"
          className="lg:col-span-2"
          action={
            <div className="flex rounded-lg border border-[#e5e7eb] bg-white p-0.5">
              {["Daily", "Weekly", "Cumulative"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTrendGranularity(g)}
                  className={cn(
                    "rounded-md px-3 py-1 text-[12px] font-semibold",
                    trendGranularity === g
                      ? "bg-[#6366f1] text-white"
                      : "text-[#6b7280] hover:bg-[#f9fafb]",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          }
        >
          <PersonalMockLineChart
            labels={trendLabels}
            series={[
              {
                label: "Forwarded Minutes",
                color: "#2563eb",
                values: trendSeries,
              },
              {
                label: "Calls",
                color: "#059669",
                values: callsTrendSeries,
              },
            ]}
            height={220}
          />
        </PersonalMockSection>
      </div>

      <PersonalMockSection title="Usage by Number">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                <th className="pb-3 pr-3">Number</th>
                <th className="pb-3 pr-3">Friendly Name</th>
                <th className="pb-3 pr-3 text-right">Calls</th>
                <th className="pb-3 pr-3 text-right">Forwarded Minutes</th>
                <th className="pb-3 pr-3 text-right">Voicemail Minutes</th>
                <th className="pb-3 pr-3 text-right">Transcription Minutes</th>
                <th className="pb-3 pr-3 text-right">% of Total Usage</th>
                <th className="pb-3 pr-3 text-right">Trend</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {filteredNumbers.map((row) => (
                <tr key={row.number}>
                  <td className="py-3 pr-3 font-medium text-[#111827]">
                    {formatPhone(row.number)}
                  </td>
                  <td className="py-3 pr-3 text-[#6b7280]">{row.friendlyName}</td>
                  <td className="py-3 pr-3 text-right">{row.calls}</td>
                  <td className="py-3 pr-3 text-right font-semibold">{row.forwarded}</td>
                  <td className="py-3 pr-3 text-right">{row.vm}</td>
                  <td className="py-3 pr-3 text-right">{row.transcribe}</td>
                  <td className="py-3 pr-3 text-right">{row.pct}%</td>
                  <td className="py-3 pr-3 text-right">
                    <PersonalMockSparkline points={row.trend} color="#2563eb" />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <PersonalMockBtn variant="outline" className="h-8 px-3 text-[12px]">
                        View
                      </PersonalMockBtn>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-[#6b7280] hover:bg-[#f3f4f6]"
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PersonalMockPagination
          showing={
            showWireframe
              ? "Showing 1 to 4 of 4 results"
              : `Showing ${filteredNumbers.length} number${filteredNumbers.length === 1 ? "" : "s"}`
          }
          total={filteredNumbers.length}
          pages={1}
        />
      </PersonalMockSection>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection title="Voicemail Usage">
          <ul className="space-y-2 text-[13px]">
            <li className="flex justify-between">
              <span className="text-[#6b7280]">List of Voicemails</span>
              <span className="font-semibold text-[#111827]">{vmStats.voicemails}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Voicemail Minutes</span>
              <span className="font-semibold text-[#111827]">{vmStats.vmMinutes}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Transcribed Messages</span>
              <span className="font-semibold text-[#111827]">{vmStats.transcribed}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Storage Used</span>
              <span className="font-semibold text-[#111827]">{vmStats.storageMb} MB</span>
            </li>
          </ul>
          <Link
            href="/personal/voicemail"
            className="mt-4 inline-block text-[12px] font-semibold text-[#2563eb]"
          >
            View Voicemail Activity →
          </Link>
        </PersonalMockSection>

        <PersonalMockSection title="Smart Routing Usage">
          <ul className="space-y-2 text-[13px]">
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Calls Through Smart Routing</span>
              <span className="font-semibold text-[#111827]">{smartRouting.callsThrough}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Routed Minutes</span>
              <span className="font-semibold text-[#111827]">{smartRouting.routedMinutes}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Menu Interactions</span>
              <span className="font-semibold text-[#111827]">{smartRouting.menuInteractions}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Voicemail Fallbacks</span>
              <span className="font-semibold text-[#111827]">{smartRouting.vmFallbacks}</span>
            </li>
          </ul>
          <Link
            href="/personal/analytics"
            className="mt-4 inline-block text-[12px] font-semibold text-[#2563eb]"
          >
            View Smart Routing Analytics →
          </Link>
        </PersonalMockSection>

        <PersonalMockSection title="Usage History">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                <th className="pb-2 text-left">Period</th>
                <th className="pb-2 text-right">Forwarded Min</th>
                <th className="pb-2 text-right">% Allowance</th>
                <th className="pb-2 text-right">Overage</th>
              </tr>
            </thead>
            <tbody>
              {(showWireframe ? WIREFRAME_USAGE_HISTORY : [
                {
                  period: "Current period",
                  forwarded: forwardingUsed,
                  pctAllowance: `${pct}%`,
                  overage: "$0.00",
                },
              ]).map((row) => (
                <tr key={row.period} className="border-b border-[#f9fafb]">
                  <td className="py-2 text-[#6b7280]">{row.period}</td>
                  <td className="py-2 text-right font-semibold text-[#111827]">{row.forwarded}</td>
                  <td className="py-2 text-right">{row.pctAllowance}</td>
                  <td className="py-2 text-right">{row.overage}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="mt-3 text-[12px] font-semibold text-[#2563eb]">
            View Full History →
          </button>
        </PersonalMockSection>
      </div>
    </PersonalMockPage>
  );
}
