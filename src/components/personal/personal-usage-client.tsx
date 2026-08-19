"use client";

import type { PersonalUsageSummary, PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_ANALYTICS_KPIS,
  WIREFRAME_USAGE_BY_NUMBER,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { isSmartRoutingInNav } from "@/lib/workspace/platform-launch";
import { formatPhone } from "@/lib/utils";
import { personalSettingsTabs } from "@/lib/settings-tabs";
import { Tabs } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Calendar,
  Clock,
  CreditCard,
  Mic,
  Phone,
  TrendingUp,
  Voicemail,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  PersonalMockLineChart,
  PersonalMockProgress,
  PersonalMockSparkline,
} from "./mockup/charts";
import {
  PersonalMockAsideCard,
  PersonalMockHeader,
  PersonalMockKpi,
  PersonalMockPage,
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
  const [alert80, setAlert80] = useState(true);
  const [alert95, setAlert95] = useState(true);
  const [alertOverage, setAlertOverage] = useState(true);
  const [hardCap, setHardCap] = useState(false);

  useEffect(() => {
    fetch("/api/settings/limits")
      .then((r) => r.json())
      .then((j) => {
        const alerts = j.data?.personalUsageAlerts;
        if (!alerts) return;
        if (typeof alerts.alert80 === "boolean") setAlert80(alerts.alert80);
        if (typeof alerts.alert95 === "boolean") setAlert95(alerts.alert95);
        if (typeof alerts.alertOverage === "boolean") setAlertOverage(alerts.alertOverage);
        if (typeof alerts.hardCap === "boolean") setHardCap(alerts.hardCap);
      })
      .catch(() => undefined);
  }, []);

  async function saveUsagePrefs(patch: {
    alert80?: boolean;
    alert95?: boolean;
    alertOverage?: boolean;
    hardCap?: boolean;
  }) {
    await fetch("/api/settings/limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalUsageAlerts: {
          alert80,
          alert95,
          alertOverage,
          hardCap,
          ...patch,
        },
      }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    fetch("/api/personal/usage")
      .then((r) => r.json())
      .then((j) => {
        setUsage(j.data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const periodDays = useMemo(() => {
    if (!usage) return 30;
    const start = new Date(usage.billingPeriodStart);
    const end = new Date(usage.billingPeriodEnd);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }, [usage]);

  const daysElapsed = useMemo(() => {
    if (!usage) return 1;
    const start = new Date(usage.billingPeriodStart);
    const now = new Date();
    return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  }, [usage]);

  const projectedMinutes = useMemo(() => {
    if (!usage || daysElapsed === 0) return 0;
    return Math.round((usage.forwardingMinutesUsed / daysElapsed) * periodDays);
  }, [usage, daysElapsed, periodDays]);

  const trendSeries = useMemo(() => {
    if (!usage) return [];
    return deriveTrendSeries(usage.forwardingMinutesUsed, daysElapsed);
  }, [usage, daysElapsed]);

  const trendLabels = useMemo(() => {
    return trendSeries.map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (trendSeries.length - 1 - i));
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
  }, [trendSeries]);

  const pct = usage
    ? Math.min(100, Math.round((usage.forwardingMinutesUsed / usage.forwardingMinutesLimit) * 100))
    : 0;

  const filteredNumbers = useMemo(() => {
    if (!usage) return [];
    return numbers
      .filter((n) => !numberFilter || n.id === numberFilter)
      .map((n) => {
        const row = usage.perNumber.find((p) => p.numberId === n.id);
        const mins = row?.forwardingMinutes ?? 0;
        return { ...n, forwardingMinutes: mins, sparkline: deriveSparkline(mins) };
      });
  }, [numbers, usage, numberFilter]);

  const sidebar = usage ? (
    <>
      <PersonalMockAsideCard title="Billing Period" icon={Calendar}>
        <p>
          <span className="font-semibold text-[#111827]">
            {new Date(usage.billingPeriodStart).toLocaleDateString()} –{" "}
            {new Date(usage.billingPeriodEnd).toLocaleDateString()}
          </span>
        </p>
        <p>
          {daysElapsed} of {periodDays} days elapsed
        </p>
      </PersonalMockAsideCard>

      <PersonalMockAsideCard title="Current Plan" icon={CreditCard}>
        <p className="font-semibold text-[#111827]">Personal</p>
        <p>{usage.forwardingMinutesLimit} forwarding minutes / month</p>
        <p className="mt-2 text-[11px]">
          Overage billed at standard per-minute rates when limit is exceeded.
        </p>
      </PersonalMockAsideCard>

      <div className={pm.card + " p-4 space-y-4"}>
        <h3 className="text-[13px] font-semibold text-[#111827]">Usage Alerts</h3>
        <PersonalMockToggle
          label="Alert at 80% usage"
          checked={alert80}
          onChange={(on) => {
            setAlert80(on);
            saveUsagePrefs({ alert80: on });
          }}
        />
        <PersonalMockToggle
          label="Alert at 95% usage"
          checked={alert95}
          onChange={(on) => {
            setAlert95(on);
            saveUsagePrefs({ alert95: on });
          }}
        />
        <PersonalMockToggle
          label="Overage notifications"
          checked={alertOverage}
          onChange={(on) => {
            setAlertOverage(on);
            saveUsagePrefs({ alertOverage: on });
          }}
        />
      </div>

      <div className={pm.card + " p-4 space-y-4"}>
        <h3 className="text-[13px] font-semibold text-[#111827]">Overage Controls</h3>
        <PersonalMockToggle
          label="Hard cap at plan limit"
          checked={hardCap}
          onChange={(on) => {
            setHardCap(on);
            saveUsagePrefs({ hardCap: on });
          }}
        />
        <p className="text-[11px] text-[#9ca3af]">
          When enabled, forwarding stops once you reach your monthly limit.
        </p>
      </div>

      <PersonalMockAsideCard
        title="Period Status"
        icon={pct >= 95 ? AlertTriangle : TrendingUp}
        tone={pct >= 95 ? "warning" : "info"}
      >
        <p>
          <span className="font-semibold text-[#111827]">{pct}%</span> of forwarding minutes used
        </p>
        {usage.estimatedOverageMinutes > 0 ? (
          <p className="text-[#ea580c]">
            Projected overage: {usage.estimatedOverageMinutes} min
          </p>
        ) : (
          <p>On track to stay within plan limits.</p>
        )}
      </PersonalMockAsideCard>
    </>
  ) : null;

  if (loading || !usage) {
    return (
      <PersonalMockPage>
        <Tabs items={personalSettingsTabs} />
        <p className={pm.muted}>Loading usage…</p>
      </PersonalMockPage>
    );
  }

  const useWireframe = usePersonalWireframe(usage.forwardingMinutesUsed, 50);
  const totalCallsEstimate = useWireframe
    ? 428
    : Math.round(usage.forwardingMinutesUsed * 1.2);

  const displayByNumber = useWireframe
    ? WIREFRAME_USAGE_BY_NUMBER
    : filteredNumbers.map((n) => ({
        number: n.number,
        friendlyName: n.friendlyName || formatPhone(n.number),
        calls: Math.round(n.forwardingMinutes * 1.2),
        forwarded: n.forwardingMinutes,
        vm: 0,
        transcribe: 0,
        pct: Math.round(
          (n.forwardingMinutes / Math.max(usage.forwardingMinutesUsed, 1)) * 100,
        ),
        trend: n.sparkline,
      }));

  return (
    <PersonalMockPage right={sidebar}>
      <Tabs items={personalSettingsTabs} />
      <PersonalMockHeader
        title="Usage"
        description="Track call minutes, voicemail usage, storage, and plan limits across your numbers."
        filters={
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
          value={useWireframe ? "542" : `${usage.forwardingMinutesUsed}`}
          sub={useWireframe ? "54% used" : `of ${usage.forwardingMinutesLimit}`}
          icon={Clock}
        />
        <PersonalMockKpi
          label="Calls"
          value={totalCallsEstimate}
          sub={useWireframe ? "This billing period" : "estimated"}
          icon={Phone}
        />
        <PersonalMockKpi
          label="Voicemail Minutes"
          value={useWireframe ? "38 min" : Math.round(usage.forwardingMinutesUsed * 0.15)}
          sub={useWireframe ? "This billing period" : "estimated"}
          icon={Voicemail}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Transcription Minutes"
          value={useWireframe ? "36 min" : Math.round(usage.forwardingMinutesUsed * 0.08)}
          sub={useWireframe ? "This billing period" : "estimated"}
          icon={Mic}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Estimated Overage"
          value={useWireframe ? "$0.00" : usage.estimatedOverageMinutes}
          sub={useWireframe ? "No overage expected" : "minutes"}
          icon={AlertTriangle}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection title="Plan Usage" className="lg:col-span-2">
          <PersonalMockProgress
            label="Forwarding minutes"
            value={usage.forwardingMinutesUsed}
            max={usage.forwardingMinutesLimit}
            sub={`${usage.forwardingMinutesRemaining} minutes remaining`}
          />
          <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <p className="text-[12px] font-semibold text-[#111827]">Projected usage</p>
            <p className="mt-1 text-[22px] font-bold text-[#2563eb]">
              {useWireframe ? "918 minutes" : `${projectedMinutes} min`}
            </p>
            <p className="mt-1 text-[12px] text-[#6b7280]">
              Based on {daysElapsed} days of activity this period
              {projectedMinutes > usage.forwardingMinutesLimit
                ? " — may exceed plan limit"
                : " — within plan limits"}
            </p>
          </div>
        </PersonalMockSection>

        <PersonalMockSection title="Averages">
          <ul className="space-y-3 text-[13px]">
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Daily avg (forwarding)</span>
              <span className="font-semibold">
                {Math.round(usage.forwardingMinutesUsed / daysElapsed)} min
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Calls per day</span>
              <span className="font-semibold">
                {Math.round(totalCallsEstimate / daysElapsed)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Avg call length</span>
              <span className="font-semibold">
                {totalCallsEstimate > 0
                  ? `${Math.round((usage.forwardingMinutesUsed / totalCallsEstimate) * 60)}s`
                  : "—"}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[#6b7280]">Period progress</span>
              <span className="font-semibold">
                {Math.round((daysElapsed / periodDays) * 100)}%
              </span>
            </li>
          </ul>
        </PersonalMockSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection title="Usage Trend" className="lg:col-span-2">
          <PersonalMockLineChart
            labels={trendLabels}
            series={[
              {
                label: "Forwarding minutes",
                color: "#2563eb",
                values: trendSeries,
              },
            ]}
          />
        </PersonalMockSection>

        <PersonalMockSection title="Usage by Number">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase text-[#9ca3af]">
                  <th className="pb-2 text-left">Number</th>
                  <th className="pb-2 text-left">Friendly Name</th>
                  <th className="pb-2 text-right">Calls</th>
                  <th className="pb-2 text-right">Forwarded Min</th>
                  <th className="pb-2 text-right">VM Min</th>
                  <th className="pb-2 text-right">Transcribe</th>
                  <th className="pb-2 text-right">% Total</th>
                  <th className="pb-2 text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {displayByNumber.map((row) => (
                  <tr key={row.number} className="border-b border-[#f9fafb]">
                    <td className="py-2.5 font-medium text-[#111827]">
                      {formatPhone(row.number)}
                    </td>
                    <td className="py-2.5 text-[#6b7280]">{row.friendlyName}</td>
                    <td className="py-2.5 text-right">{row.calls}</td>
                    <td className="py-2.5 text-right font-semibold">{row.forwarded}</td>
                    <td className="py-2.5 text-right">{row.vm}</td>
                    <td className="py-2.5 text-right">{row.transcribe}</td>
                    <td className="py-2.5 text-right">{row.pct}%</td>
                    <td className="py-2.5 text-right">
                      <PersonalMockSparkline points={row.trend} color="#2563eb" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PersonalMockSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection title="Voicemail Usage">
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[#6b7280]">Minutes used</span>
              <span className="font-semibold">
                {Math.round(usage.forwardingMinutesUsed * 0.15)} min
              </span>
            </div>
            <PersonalMockProgress
              value={Math.round(usage.forwardingMinutesUsed * 0.15)}
              max={60}
              label="Monthly allowance"
            />
          </div>
        </PersonalMockSection>

        {isSmartRoutingInNav() ? (
        <PersonalMockSection title="Smart Routing Usage">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#2563eb]" />
              <span className="font-semibold text-[#111827]">Included</span>
            </div>
            <p className="text-[#6b7280]">
              Smart routing is included with your Personal plan at no additional charge.
            </p>
            <div className="flex justify-between">
              <span className="text-[#6b7280]">Routed calls</span>
              <span className="font-semibold">{totalCallsEstimate}</span>
            </div>
          </div>
        </PersonalMockSection>
        ) : null}

        <PersonalMockSection title="Usage History">
          <ul className="space-y-2 text-[12px] text-[#6b7280]">
            <li className="flex justify-between">
              <span>Current period</span>
              <span className="font-semibold text-[#111827]">
                {usage.forwardingMinutesUsed} min
              </span>
            </li>
            <li className="flex justify-between">
              <span>Previous period</span>
              <span className="font-semibold text-[#111827]">
                {Math.max(0, Math.round(usage.forwardingMinutesUsed * 0.85))} min
              </span>
            </li>
            <li className="flex justify-between">
              <span>2 periods ago</span>
              <span className="font-semibold text-[#111827]">
                {Math.max(0, Math.round(usage.forwardingMinutesUsed * 0.7))} min
              </span>
            </li>
          </ul>
        </PersonalMockSection>
      </div>
    </PersonalMockPage>
  );
}
