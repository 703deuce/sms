"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Link2,
  MailOpen,
  MousePointerClick,
  RefreshCcw,
} from "lucide-react";
import AnalyticsTabs from "./AnalyticsTabs";
import MetricCard from "./MetricCard";
import BookingTrendChart from "./BookingTrendChart";
import PopularBookingTypes from "./PopularBookingTypes";
import PopularTimes from "./PopularTimes";
import ExportMenu from "./ExportMenu";
import {
  ChartsSkeleton,
  DegradedBanner,
  ErrorState,
  FirstUseEmpty,
  MetricsSkeleton,
  NoResults,
} from "./States";
import {
  analytics7,
  analytics30,
  analyticsEmpty,
  formatNumber,
  type AnalyticsData,
} from "../mock-data";

type Range = 7 | 30;

// Sandbox state simulator — cycles: normal → loading → empty → no-results → error → degraded
// In production this is driven by /api/appointments/analytics?range=N
const DEMO_STATE: "normal" | "loading" | "first-use" | "no-results" | "error" | "degraded" =
  "normal";

export default function AnalyticsShell() {
  const [range, setRange] = useState<Range>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Preserves existing fetch wiring: GET /api/appointments/analytics?range={range}
  useEffect(() => {
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      if (DEMO_STATE === "error") {
        setData(null);
        setError(true);
      } else if (DEMO_STATE === "first-use") {
        setData(analyticsEmpty);
      } else {
        setData(range === 7 ? analytics7 : analytics30);
      }
      setLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [range]);

  const metrics = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Booked", value: formatNumber(data.booked), icon: <CalendarPlus />, tone: "tone-accent" },
      { label: "Confirmed", value: formatNumber(data.confirmed), icon: <CheckCircle2 />, tone: "tone-success" },
      { label: "Awaiting", value: formatNumber(data.awaiting), icon: <Clock3 />, tone: "tone-info" },
      { label: "Completed", value: formatNumber(data.completed), icon: <CalendarCheck2 />, tone: "tone-success" },
      { label: "Canceled", value: formatNumber(data.canceled), icon: <CalendarX2 />, tone: "tone-danger" },
      { label: "No-shows", value: formatNumber(data.noShow), icon: <CalendarClock />, tone: "tone-warning" },
      { label: "Reschedule requests", value: formatNumber(data.rescheduleRequested), icon: <RefreshCcw />, tone: "tone-violet" },
      { label: "Confirmation rate", value: `${data.confirmationRate}%`, icon: <BarChart3 />, tone: "tone-accent" },
    ];
  }, [data]);

  const showFirstUse =
    !loading && !error && data !== null && data.booked === 0 && data.remindersSent === 0;
  const showNoResults =
    !loading && !error && data !== null && data.booked === 0 && data.remindersSent > 0;

  return (
    <div className="an-page">
      {/* Page header */}
      <div className="an-header">
        <div>
          <h1 className="an-header-title">Analytics</h1>
          <p className="an-header-sub">
            Booking volume, conversion, and popular booking patterns.
          </p>
        </div>
        <div className="an-header-actions">
          <div className="range-seg" role="group" aria-label="Date range">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={range === r ? "active" : ""}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r} days
              </button>
            ))}
          </div>
          <ExportMenu rangeDays={range} />
        </div>
      </div>

      {/* Local analytics navigation */}
      <AnalyticsTabs active="booking" />

      {DEMO_STATE === "degraded" ? <DegradedBanner /> : null}

      {loading ? (
        <>
          <MetricsSkeleton />
          <ChartsSkeleton />
        </>
      ) : error ? (
        <ErrorState onRetry={() => setRange((r) => r)} />
      ) : showFirstUse ? (
        <FirstUseEmpty />
      ) : showNoResults ? (
        <NoResults rangeDays={range} onReset={() => setRange(30)} />
      ) : data ? (
        <>
          {/* Primary KPI grid */}
          <div className="metric-grid">
            {metrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                icon={m.icon}
                tone={m.tone}
              />
            ))}
          </div>

          {/* Trend + popular types */}
          <div className="an-cols">
            <BookingTrendChart series={data.series} rangeDays={range} />
            <PopularBookingTypes types={data.popularTypes} />
          </div>

          {/* Popular times + conversion/attribution */}
          <div className="an-cols">
            <PopularTimes times={data.popularTimes} />
            <div className="card card-pad">
              <div className="card-head">
                <div>
                  <h3 className="card-title">Booking conversion</h3>
                  <p className="card-sub">
                    How bookings arrive and convert · last {range} days
                  </p>
                </div>
              </div>
              <div className="conv-strip" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="conv-cell">
                  <p className="conv-label">
                    <Link2 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -1 }} />
                    UTM conversions
                  </p>
                  <p className="conv-value">{formatNumber(data.utmConversions)}</p>
                  <p className="conv-hint">Bookings from tracked links</p>
                </div>
                <div className="conv-cell">
                  <p className="conv-label">
                    <BarChart3 size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -1 }} />
                    Conversion rate
                  </p>
                  <p className="conv-value">{data.conversionRate}%</p>
                  <p className="conv-hint">Booking page visits → booked</p>
                </div>
                <div className="conv-cell">
                  <p className="conv-label">
                    <MailOpen size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -1 }} />
                    Email opens
                  </p>
                  <p className="conv-value">{formatNumber(data.emailOpens)}</p>
                  <p className="conv-hint">Confirmation & reminder emails</p>
                </div>
                <div className="conv-cell">
                  <p className="conv-label">
                    <MousePointerClick size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -1 }} />
                    Email clicks
                  </p>
                  <p className="conv-value">{formatNumber(data.emailClicks)}</p>
                  <p className="conv-hint">Links followed from email</p>
                </div>
              </div>
            </div>
          </div>

          {/* Outcome rates */}
          <div className="card card-pad">
            <div className="card-head">
              <div>
                <h3 className="card-title">Outcome rates</h3>
                <p className="card-sub">
                  Share of booked appointments by outcome · last {range} days
                </p>
              </div>
            </div>
            <div className="conv-strip">
              <div className="conv-cell">
                <p className="conv-label">Confirmation rate</p>
                <p className="conv-value">{data.confirmationRate}%</p>
                <p className="conv-hint">{formatNumber(data.confirmed)} confirmed</p>
              </div>
              <div className="conv-cell">
                <p className="conv-label">Cancellation rate</p>
                <p className="conv-value">{data.cancellationRate}%</p>
                <p className="conv-hint">{formatNumber(data.canceled)} canceled</p>
              </div>
              <div className="conv-cell">
                <p className="conv-label">No-show rate</p>
                <p className="conv-value">{data.noShowRate}%</p>
                <p className="conv-hint">{formatNumber(data.noShow)} no-shows</p>
              </div>
              <div className="conv-cell">
                <p className="conv-label">Reschedule rate</p>
                <p className="conv-value">{data.rescheduleRate}%</p>
                <p className="conv-hint">
                  {formatNumber(data.rescheduleRequested)} requests
                </p>
              </div>
            </div>
          </div>

          {/* Reminder context strip */}
          <div className="card card-pad" style={{ marginTop: 12 }}>
            <div className="card-head">
              <div>
                <h3 className="card-title">Reminder activity</h3>
                <p className="card-sub">
                  Messages supporting these bookings · last {range} days
                </p>
              </div>
            </div>
            <div className="conv-strip">
              <div className="conv-cell">
                <p className="conv-label">
                  <Bell size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -1 }} />
                  Reminders sent
                </p>
                <p className="conv-value">{formatNumber(data.remindersSent)}</p>
                <p className="conv-hint">Across all reminder sequences</p>
              </div>
              <div className="conv-cell">
                <p className="conv-label">
                  <AlertTriangle size={11} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -1 }} />
                  Failed deliveries
                </p>
                <p className="conv-value">{formatNumber(data.remindersFailed)}</p>
                <p className="conv-hint">See Reminders analytics for detail</p>
              </div>
              <div className="conv-cell">
                <p className="conv-label">SMS responses</p>
                <p className="conv-value">{formatNumber(data.smsResponses)}</p>
                <p className="conv-hint">Confirmations & replies</p>
              </div>
              <div className="conv-cell">
                <p className="conv-label">Delivery rate</p>
                <p className="conv-value">
                  {data.remindersSent > 0
                    `${((1 - data.remindersFailed / data.remindersSent) * 100).toFixed(1)}%`
                    "—"}
                </p>
                <p className="conv-hint">Sent minus failures</p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
