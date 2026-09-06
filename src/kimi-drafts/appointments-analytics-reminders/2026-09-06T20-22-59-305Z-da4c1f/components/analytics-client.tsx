"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Download,
  MailOpen,
  MessageSquareText,
  MousePointerClick,
  RefreshCcw,
  Send,
  Smartphone,
} from "lucide-react";
import { getAnalytics, type AnalyticsData } from "../mock-data";
import { Card, StatusChip, formatNumber } from "./ui";
import { MetricCard, MetricSkeleton } from "./metric-card";
import { ReminderSeriesChart } from "./reminder-series-chart";

const RANGE_OPTIONS: Array<{ value: 7 | 30; label: string }> = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
];

export function AppointmentsAnalyticsClient() {
  const [range, setRange] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportEmail, setExportEmail] = useState("");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Mirrors production fetch to /api/appointments/analytics?range=N
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      if (cancelled) return;
      try {
        setData(getAnalytics(range));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [range]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Escape closes the export modal (modal interaction contract)
  useEffect(() => {
    if (!exportOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !exporting) setExportOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportOpen, exporting]);

  const isEmpty = useMemo(
    () => !!data && data.remindersSent === 0 && data.booked === 0,
    [data],
  );

  const degraded = useMemo(
    () => !!data && data.remindersFailed > 0 && data.deliveryRate < 99,
    [data],
  );

  async function handleExport() {
    setExporting(true);
    // Mirrors POST to /api/appointments/analytics/export
    await new Promise((r) => setTimeout(r, 700));
    setExporting(false);
    setExportOpen(false);
    setToast(`Report export scheduled${exportEmail ? ` for ${exportEmail}` : ""}. You'll receive it shortly.`);
    setExportEmail("");
  }

  return (
    <div className="tv-stack">
      {/* Page header */}
      <div className="tv-page-header">
        <div>
          <h1 className="tv-title">Reminders</h1>
          <p className="tv-subtitle">
            Reminder delivery and customer response metrics for the selected period.
          </p>
        </div>
        <div className="tv-row" style={{ gap: 10 }}>
          <div className="tv-seg" role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={range === option.value ? "active" : ""}
                aria-pressed={range === option.value}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button className="tv-btn" onClick={() => setExportOpen(true)}>
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <>
          <MetricSkeleton />
          <Card className="tv-card-pad">
            <div className="tv-skel" style={{ height: 14, width: 160, marginBottom: 14 }} />
            <div className="tv-skel" style={{ height: 220, width: "100%" }} />
          </Card>
        </>
      ) : error ? (
        /* Error state — page structure preserved */
        <div className="tv-empty" role="alert">
          <div className="tv-empty-icon">
            <AlertTriangle size={20} />
          </div>
          <h3>Analytics couldn&apos;t be loaded</h3>
          <p>
            Reminder metrics for this period aren&apos;t available right now. Your
            reminder sequences are unaffected.
          </p>
          <button
            className="tv-btn tv-btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => {
              setError(false);
              setLoading(true);
              setTimeout(() => {
                setData(getAnalytics(range));
                setLoading(false);
              }, 450);
            }}
          >
            <RefreshCcw size={14} />
            Retry
          </button>
        </div>
      ) : !data || isEmpty ? (
        /* First-use empty state */
        <div className="tv-empty">
          <div className="tv-empty-icon">
            <Bell size={20} />
          </div>
          <h3>No reminder activity yet</h3>
          <p>
            Reminder metrics appear here once appointments are booked and your
            reminder sequences start sending confirmations and reminders.
          </p>
          <button
            className="tv-btn tv-btn-primary"
            style={{ marginTop: 16 }}
            onClick={() =>
              setToast("Opening Automations → Reminder Sequences…")
            }
          >
            Set up reminder sequences
          </button>
        </div>
      ) : (
        <>
          {/* Degraded / partial state */}
          {degraded ? (
            <div className="tv-alert" role="status">
              <AlertTriangle size={16} style={{ flex: "none", marginTop: 1 }} />
              <div>
                <strong>{data.remindersFailed} reminders failed</strong> in this
                period. Delivery rate is {data.deliveryRate}%. Review failed
                sends in Automation activity.
              </div>
            </div>
          ) : null}

          {/* Primary KPI row */}
          <div className="tv-metrics">
            <MetricCard
              label="Reminders sent"
              value={formatNumber(data.remindersSent)}
              hint={`Last ${range} days`}
              icon={Send}
              tone="primary"
            />
            <MetricCard
              label="Delivered"
              value={formatNumber(data.remindersDelivered)}
              hint={`${data.deliveryRate}% delivery rate`}
              icon={CheckCircle2}
              tone="emerald"
            />
            <MetricCard
              label="Failed"
              value={formatNumber(data.remindersFailed)}
              hint={data.remindersFailed > 0 ? "Needs attention" : "No failures"}
              icon={AlertTriangle}
              tone={data.remindersFailed > 0 ? "amber" : "emerald"}
            />
            <MetricCard
              label="SMS responses"
              value={formatNumber(data.smsResponses)}
              hint="Customer replies to reminders"
              icon={MessageSquareText}
              tone="sky"
            />
            <MetricCard
              label="Confirmation rate"
              value={`${data.confirmationRate}%`}
              hint={`${formatNumber(data.confirmed)} confirmed appointments`}
              icon={CalendarCheck2}
              tone="emerald"
            />
            <MetricCard
              label="No-show rate"
              value={`${data.noShowRate}%`}
              hint={`${formatNumber(data.noShow)} no-shows`}
              icon={Clock3}
              tone="amber"
            />
            <MetricCard
              label="Email opens"
              value={formatNumber(data.emailOpens)}
              hint={`${data.emailOpenRate}% open rate · ${formatNumber(data.emailClicks)} clicks`}
              icon={MailOpen}
              tone="violet"
            />
            <MetricCard
              label="Reschedule requests"
              value={formatNumber(data.rescheduleRequested)}
              hint={`${data.rescheduleRate}% of booked`}
              icon={RefreshCcw}
              tone="rose"
            />
          </div>

          {/* Chart + channel breakdown */}
          <div className="tv-grid-3">
            <Card className="tv-card-pad">
              <div className="tv-row" style={{ marginBottom: 10 }}>
                <div>
                  <h2 className="tv-card-title">Reminders sent</h2>
                  <p className="tv-card-desc">Daily volume over the last {range} days.</p>
                </div>
                <StatusChip tone="neutral">{formatNumber(data.remindersSent)} total</StatusChip>
              </div>
              <ReminderSeriesChart series={data.series} />
            </Card>

            <Card className="tv-card-pad">
              <h2 className="tv-card-title">Delivery by channel</h2>
              <p className="tv-card-desc" style={{ marginBottom: 6 }}>
                Where reminders were sent and how they performed.
              </p>
              {data.byChannel.map((c) => {
                const rate = c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0;
                return (
                  <div className="tv-bar-row" key={c.channel}>
                    <div className="tv-bar-head">
                      <span style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {c.channel === "SMS" ? <Smartphone size={14} /> : <MailOpen size={14} />}
                        {c.channel}
                      </span>
                      <span style={{ color: "var(--tv-muted)", fontVariantNumeric: "tabular-nums" }}>
                        {formatNumber(c.delivered)} / {formatNumber(c.sent)} · {rate}%
                      </span>
                    </div>
                    <div className="tv-bar-track">
                      <div
                        className="tv-bar-fill"
                        style={{ width: `${rate}%`, background: rate >= 98 ? "var(--tv-emerald)" : "var(--tv-amber)" }}
                      />
                    </div>
                    {c.failed > 0 ? (
                      <span style={{ fontSize: 11.5, color: "var(--tv-amber)" }}>
                        {c.failed} failed
                      </span>
                    ) : null}
                  </div>
                );
              })}
              <dl style={{ margin: "14px 0 0" }}>
                <div className="tv-kv">
                  <dt>Delivery rate</dt>
                  <dd>{data.deliveryRate}%</dd>
                </div>
                <div className="tv-kv">
                  <dt>Email open rate</dt>
                  <dd>{data.emailOpenRate}%</dd>
                </div>
                <div className="tv-kv">
                  <dt>Email click rate</dt>
                  <dd>{data.emailClickRate}%</dd>
                </div>
                <div className="tv-kv">
                  <dt>SMS responses</dt>
                  <dd>{formatNumber(data.smsResponses)}</dd>
                </div>
              </dl>
            </Card>
          </div>

          {/* Sequence performance table */}
          <Card>
            <div className="tv-card-pad" style={{ paddingBottom: 6 }}>
              <h2 className="tv-card-title">Reminder sequence performance</h2>
              <p className="tv-card-desc">
                Delivery and response rates for each step of your default reminder sequence.
              </p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="tv-table">
                <thead>
                  <tr>
                    <th scope="col">Sequence step</th>
                    <th scope="col" className="tv-num">Sent</th>
                    <th scope="col" className="tv-num">Delivered</th>
                    <th scope="col" className="tv-num">Failed</th>
                    <th scope="col" className="tv-num">Responses</th>
                    <th scope="col" className="tv-num">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySequence.map((s) => (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td className="tv-num">{formatNumber(s.sent)}</td>
                      <td className="tv-num">{formatNumber(s.delivered)}</td>
                      <td className="tv-num">{formatNumber(s.failed)}</td>
                      <td className="tv-num">{formatNumber(s.responses)}</td>
                      <td className="tv-num">
                        {s.failed === 0 ? (
                          <StatusChip tone="emerald">Healthy</StatusChip>
                        ) : s.failed <= 2 ? (
                          <StatusChip tone="sky">Mostly delivered</StatusChip>
                        ) : (
                          <StatusChip tone="amber">Needs attention</StatusChip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Outcome metrics */}
          <div className="tv-grid-2">
            <Card className="tv-card-pad">
              <h2 className="tv-card-title">Reminder outcomes</h2>
              <p className="tv-card-desc" style={{ marginBottom: 8 }}>
                How reminders influenced appointment results this period.
              </p>
              <dl style={{ margin: 0 }}>
                <div className="tv-kv">
                  <dt>Appointments booked</dt>
                  <dd>{formatNumber(data.booked)}</dd>
                </div>
                <div className="tv-kv">
                  <dt>Confirmed</dt>
                  <dd>{formatNumber(data.confirmed)}</dd>
                </div>
                <div className="tv-kv">
                  <dt>Completed</dt>
                  <dd>{formatNumber(data.completed)}</dd>
                </div>
                <div className="tv-kv">
                  <dt>Awaiting confirmation</dt>
                  <dd>{formatNumber(data.awaiting)}</dd>
                </div>
                <div className="tv-kv">
                  <dt>Canceled</dt>
                  <dd>{formatNumber(data.canceled)}</dd>
                </div>
                <div className="tv-kv">
                  <dt>No-shows</dt>
                  <dd>{formatNumber(data.noShow)}</dd>
                </div>
              </dl>
            </Card>
            <Card className="tv-card-pad">
              <div className="tv-row" style={{ alignItems: "flex-start" }}>
                <div>
                  <h2 className="tv-card-title">About these metrics</h2>
                  <p className="tv-card-desc" style={{ marginBottom: 8 }}>
                    How reminder analytics are calculated.
                  </p>
                </div>
                <div className="tv-metric-icon tv-tone-primary" aria-hidden="true">
                  <BellRing size={16} />
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--tv-text-2)", display: "flex", flexDirection: "column", gap: 8 }}>
                <li>Delivery rate counts reminders confirmed delivered by the messaging provider.</li>
                <li>Failed reminders include provider rejections and suppressed sends (e.g. customer opt-out).</li>
                <li>Email open and click rates are measured against delivered reminder emails with tracking enabled.</li>
                <li>Confirmation rate reflects appointments marked confirmed out of all booked appointments.</li>
              </ul>
              <div style={{ marginTop: 14 }}>
                <button
                  className="tv-btn tv-btn-sm"
                  onClick={() => setToast("Opening Automations → Activity…")}
                >
                  <MousePointerClick size={14} />
                  View automation activity
                </button>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Export modal */}
      {exportOpen ? (
        <div
          className="tv-modal-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !exporting) setExportOpen(false);
          }}
        >
          <div className="tv-modal">
            <h3 id="export-title">Export reminder analytics</h3>
            <p>
              Download a CSV of reminder metrics for the last {range} days, or email it
              to a teammate.
            </p>
            <div className="tv-field">
              <label htmlFor="export-email">Email to (optional)</label>
              <input
                id="export-email"
                type="email"
                className="tv-input"
                placeholder="name@example.com"
                value={exportEmail}
                onChange={(e) => setExportEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="tv-row" style={{ justifyContent: "flex-end" }}>
              <button className="tv-btn" onClick={() => setExportOpen(false)} disabled={exporting}>
                Cancel
              </button>
              <button className="tv-btn tv-btn-primary" onClick={handleExport} disabled={exporting}>
                {exporting ? "Scheduling…" : "Export report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="tv-toast" role="status">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
