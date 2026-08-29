"use client";

import { formatSlickDateTime } from "@/components/audience/slick-audience-ui";
import { PersonalMockProgress } from "@/components/personal/mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockTabs,
  pm,
} from "@/components/personal/mockup/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import type { VoiceBillingDashboard } from "@/lib/voice/billing-dashboard";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  Calendar,
  CreditCard,
  Download,
  ExternalLink,
  Phone,
  Receipt,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function cents(n: number) {
  return formatCurrency(n / 100);
}

function invoiceStatusTone(status: string | null): "green" | "orange" | "gray" | "blue" {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "green";
  if (s === "open" || s === "draft") return "orange";
  if (s === "void" || s === "uncollectible") return "gray";
  return "blue";
}

function invoiceStatusLabel(status: string | null) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function VoiceBillingPanel() {
  const [days] = useState(30);
  const [data, setData] = useState<VoiceBillingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/voice/billing?days=${days}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  async function openStripePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/settings/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stripe_portal" }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading && !data) {
    return <p className="text-[13px] text-[#6b7280]">Loading usage & billing…</p>;
  }

  const analytics = data?.analytics;

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Usage & Billing"
        description="Manage your subscription, usage limits, and billing details."
      />
      <VoiceSubNav />

      <PersonalMockTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "usage", label: "Usage Details" },
          { id: "invoices", label: "Invoices" },
          { id: "payment", label: "Payment Methods" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn(pm.card, "p-5")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Current plan
                  </p>
                  <p className="mt-2 text-[22px] font-bold text-[#111827]">
                    {data?.plan.name ?? "Growth"} Plan
                  </p>
                  <p className="mt-1 text-[14px] text-[#6b7280]">
                    {data?.plan.priceLabel ?? "$99/mo"}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2ff] text-[#6366f1]">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
              <Link href="/settings/billing" className="mt-5 inline-block no-underline">
                <PersonalMockBtn variant="outline">Change plan</PersonalMockBtn>
              </Link>
            </div>

            <div className={cn(pm.card, "p-5")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Billing cycle
                  </p>
                  <p className="mt-2 text-[22px] font-bold text-[#111827]">
                    Renews {data?.billingCycle.renewsLabel ?? "—"}
                  </p>
                  <p className="mt-1 text-[14px] text-[#6b7280]">
                    Current period usage and limits reset on renewal.
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ecfdf5] text-[#059669]">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
              {data?.spendLimitCents ? (
                <p className="mt-4 text-[13px] text-[#6b7280]">
                  Spending limit:{" "}
                  <span className="font-semibold text-[#111827]">
                    {cents(data.spentThisPeriodCents)} / {cents(data.spendLimitCents)}
                  </span>
                </p>
              ) : (
                <Link
                  href="/voice/settings"
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6366f1] no-underline hover:underline"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Set spending limit
                </Link>
              )}
            </div>
          </div>

          <PersonalMockSection title="Usage this month">
            <div className="space-y-5">
              {(data?.usageMeters || []).map((meter) => (
                <PersonalMockProgress
                  key={meter.id}
                  label={meter.label}
                  value={meter.used}
                  max={meter.limit}
                  sub={meter.detail}
                />
              ))}
            </div>
            <div className="mt-6 grid gap-4 border-t border-[#f3f4f6] pt-5 sm:grid-cols-3">
              <div>
                <p className="text-[12px] text-[#6b7280]">Total voice cost</p>
                <p className="mt-1 text-[20px] font-bold text-[#111827]">
                  {cents(analytics?.totalCostCents ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#6b7280]">Total calls</p>
                <p className="mt-1 text-[20px] font-bold text-[#111827]">
                  {formatNumber(analytics?.totalCalls ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#6b7280]">Avg. cost per call</p>
                <p className="mt-1 text-[20px] font-bold text-[#111827]">
                  {cents(analytics?.costPerCall ?? 0)}
                </p>
              </div>
            </div>
          </PersonalMockSection>

          <PersonalMockSection
            title="Recent invoices"
            action={
              data?.invoices.length ? (
                <button
                  type="button"
                  onClick={() => setTab("invoices")}
                  className="text-[13px] font-semibold text-[#6366f1]"
                >
                  View all
                </button>
              ) : null
            }
          >
            {(data?.invoices || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="mb-3 h-10 w-10 text-[#d1d5db]" />
                <p className="text-[14px] font-medium text-[#111827]">No invoices yet</p>
                <p className="mt-1 max-w-sm text-[13px] text-[#6b7280]">
                  Invoices appear here after your first billing cycle when Stripe is configured.
                </p>
              </div>
            ) : (
              <Table className="text-[13px]">
                <THead>
                  <TR className="border-[#f3f4f6]">
                    <TH>Invoice</TH>
                    <TH>Date</TH>
                    <TH>Amount</TH>
                    <TH>Status</TH>
                    <TH className="text-right"> </TH>
                  </TR>
                </THead>
                <TBody>
                  {data?.invoices.slice(0, 5).map((inv) => (
                    <TR key={inv.id} className="border-[#f9fafb]">
                      <TD className="font-medium text-[#111827]">{inv.number || inv.id.slice(-8)}</TD>
                      <TD className="text-[#6b7280]">
                        {new Date(inv.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TD>
                      <TD className="font-semibold tabular-nums text-[#111827]">
                        {cents(inv.amountCents)}
                      </TD>
                      <TD>
                        <PersonalMockPill tone={invoiceStatusTone(inv.status)}>
                          {invoiceStatusLabel(inv.status)}
                        </PersonalMockPill>
                      </TD>
                      <TD className="text-right">
                        {inv.pdf || inv.hostedInvoiceUrl ? (
                          <a
                            href={inv.pdf || inv.hostedInvoiceUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]"
                            aria-label="Download invoice"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-[#d1d5db]">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PersonalMockSection>
        </div>
      ) : null}

      {tab === "usage" ? (
        <div className="mt-6 space-y-6">
          <PersonalMockSection title="Usage this month">
            <div className="space-y-5">
              {(data?.usageMeters || []).map((meter) => (
                <PersonalMockProgress
                  key={meter.id}
                  label={meter.label}
                  value={meter.used}
                  max={meter.limit}
                  sub={meter.detail}
                />
              ))}
            </div>
          </PersonalMockSection>

          <PersonalMockSection title="Cost breakdown">
            {(data?.categoryBreakdown || []).length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">
                Usage costs will appear after your first calls.
              </p>
            ) : (
              <div className="space-y-3">
                {data?.categoryBreakdown.map((row) => {
                  const total = analytics?.totalCostCents || 1;
                  const pct = Math.round((row.costCents / total) * 100);
                  return (
                    <div key={row.id}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#111827]">{row.label}</span>
                        <span className="text-[#6b7280]">
                          {row.quantity > 0
                            ? `${row.quantity.toFixed(1)} ${row.unit} · `
                            : ""}
                          {cents(row.costCents)} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full rounded-full bg-[#e5e7eb]">
                        <div
                          className="h-2.5 rounded-full bg-[#6366f1]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PersonalMockSection>

          <PersonalMockSection title="Cost by agent">
            {(data?.agentBreakdown || []).length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No agent costs in this period yet.</p>
            ) : (
              <Table className="text-[13px]">
                <THead>
                  <TR className="border-[#f3f4f6]">
                    <TH>Agent</TH>
                    <TH>Calls</TH>
                    <TH>Cost</TH>
                  </TR>
                </THead>
                <TBody>
                  {data?.agentBreakdown.map((row) => (
                    <TR key={row.agentId} className="border-[#f9fafb]">
                      <TD>
                        <Link
                          href={`/voice/agents/${row.agentId}`}
                          className="font-semibold text-[#111827] no-underline hover:text-[#6366f1]"
                        >
                          {row.agentName}
                        </Link>
                      </TD>
                      <TD className="text-[#6b7280]">{formatNumber(row.calls)}</TD>
                      <TD className="font-semibold tabular-nums text-[#111827]">
                        {cents(row.costCents)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PersonalMockSection>

          <PersonalMockSection title="Recent usage records">
            {(data?.recentUsage || []).length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No usage records in this period yet.</p>
            ) : (
              <Table className="text-[13px]">
                <THead>
                  <TR className="border-[#f3f4f6]">
                    <TH>When</TH>
                    <TH>Category</TH>
                    <TH>Quantity</TH>
                    <TH>Cost</TH>
                  </TR>
                </THead>
                <TBody>
                  {data?.recentUsage.map((row) => (
                    <TR key={row.id} className="border-[#f9fafb]">
                      <TD className="whitespace-nowrap text-[#6b7280]">
                        {formatSlickDateTime(row.createdAt)}
                      </TD>
                      <TD className="text-[#111827]">{row.category}</TD>
                      <TD className="text-[#6b7280]">
                        {row.quantity.toFixed(2)} {row.unit}
                      </TD>
                      <TD className="font-semibold tabular-nums text-[#111827]">
                        {cents(row.billedCostCents)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PersonalMockSection>
        </div>
      ) : null}

      {tab === "invoices" ? (
        <div className="mt-6">
          <PersonalMockSection title="Invoices">
            {(data?.invoices || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Receipt className="mb-3 h-10 w-10 text-[#d1d5db]" />
                <p className="text-[14px] font-medium text-[#111827]">No invoices yet</p>
                <p className="mt-1 max-w-md text-[13px] text-[#6b7280]">
                  Connect Stripe billing to view and download invoices for your workspace.
                </p>
                <Link href="/settings/billing" className="mt-4 no-underline">
                  <PersonalMockBtn variant="outline">Go to account billing</PersonalMockBtn>
                </Link>
              </div>
            ) : (
              <Table className="text-[13px]">
                <THead>
                  <TR className="border-[#f3f4f6]">
                    <TH>Invoice</TH>
                    <TH>Date</TH>
                    <TH>Amount</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Download</TH>
                  </TR>
                </THead>
                <TBody>
                  {data?.invoices.map((inv) => (
                    <TR key={inv.id} className="border-[#f9fafb]">
                      <TD className="font-medium text-[#111827]">{inv.number || inv.id.slice(-8)}</TD>
                      <TD className="text-[#6b7280]">
                        {new Date(inv.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TD>
                      <TD className="font-semibold tabular-nums text-[#111827]">
                        {cents(inv.amountCents)}
                      </TD>
                      <TD>
                        <PersonalMockPill tone={invoiceStatusTone(inv.status)}>
                          {invoiceStatusLabel(inv.status)}
                        </PersonalMockPill>
                      </TD>
                      <TD className="text-right">
                        {inv.pdf || inv.hostedInvoiceUrl ? (
                          <a
                            href={inv.pdf || inv.hostedInvoiceUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#6366f1] no-underline hover:underline"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-[#d1d5db]">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PersonalMockSection>
        </div>
      ) : null}

      {tab === "payment" ? (
        <div className="mt-6 space-y-6">
          <div className={cn(pm.card, "p-5")}>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#6366f1]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#111827]">Payment method</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">
                  {data?.stripeConfigured
                    ? "Manage your card on file, billing address, and subscription in the Stripe customer portal."
                    : "Stripe billing is not configured for this environment. Contact your administrator to enable payments."}
                </p>
                {data?.stripeConfigured ? (
                  <PersonalMockBtn
                    className="mt-4"
                    disabled={portalLoading}
                    onClick={() => void openStripePortal()}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {portalLoading ? "Opening…" : "Open billing portal"}
                  </PersonalMockBtn>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cn(pm.card, "p-5")}>
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5] text-[#059669]">
                <Phone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#111827]">Voice usage limits</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">
                  Set monthly spending caps and emergency stop rules for outbound voice activity.
                </p>
                <Link href="/voice/settings" className="mt-4 inline-block no-underline">
                  <PersonalMockBtn variant="outline">
                    <Settings className="h-4 w-4" />
                    Voice settings
                  </PersonalMockBtn>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PersonalMockPage>
  );
}
