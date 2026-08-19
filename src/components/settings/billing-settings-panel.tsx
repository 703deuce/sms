"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { settingsTabs, personalSettingsTabs } from "@/lib/settings-tabs";

type UsageRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  outbound: number;
  costCents: number;
  smsSegments: number;
  mmsMessages: number;
};

type Metrics = {
  balance: number;
  creditsRemaining: number;
  messagesSentPeriod: number;
};

type Billing = {
  plan: string;
  balanceCents: number;
  balance: number;
  creditTrackingEnabled: boolean;
  stripeConfigured: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

type LedgerEntry = {
  id: string;
  amountCents: number;
  balanceAfterCents?: number | null;
  description: string;
  source: string;
  createdAt: string;
};

type Estimate = {
  currency: string;
  periodLabel: string;
  lineItems: Array<{ id: string; label: string; amountCents: number; detail?: string }>;
  subtotalCents: number;
  estimatedTaxCents: number;
  totalCents: number;
  notes: string[];
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountDue: number;
    amountPaid: number;
    created: number;
    hostedInvoiceUrl: string | null;
    pdf: string | null;
  }>;
};

function titleCasePlan(plan: string) {
  if (!plan) return "—";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function cents(n: number) {
  return formatCurrency(n / 100);
}

export function BillingSettingsPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [creditAmount, setCreditAmount] = useState(50);
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState("");
  const [personalMode, setPersonalMode] = useState(false);
  const [forwardingMinutesUsed, setForwardingMinutesUsed] = useState<number | null>(null);

  function applyData(data: {
    metrics?: Metrics;
    usage?: UsageRow[];
    billing?: Billing;
    ledger?: LedgerEntry[];
    estimate?: Estimate;
  }) {
    if (data.metrics) setMetrics(data.metrics);
    setUsage(data.usage || []);
    if (data.billing) setBilling(data.billing);
    if (data.ledger) setLedger(data.ledger);
    if (data.estimate) setEstimate(data.estimate);
  }

  useEffect(() => {
    fetch("/api/settings/billing")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) applyData(j.data);
      })
      .catch(() => undefined);
    fetch("/api/workspace")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.workspaceType === "PERSONAL") {
          setPersonalMode(true);
          fetch("/api/personal/usage")
            .then((u) => u.json())
            .then((usageJson) => {
              const used = usageJson.data?.forwardingMinutesUsed;
              if (typeof used === "number") setForwardingMinutesUsed(used);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, []);

  async function purchaseCredits() {
    setPurchasing(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: creditAmount * 100 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Purchase failed");
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage(`Added ${formatCurrency(creditAmount)} in credits.`);
      const refresh = await fetch("/api/settings/billing").then((r) => r.json());
      if (refresh.data) applyData(refresh.data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  }

  async function openStripePortal() {
    setMessage("");
    const res = await fetch("/api/settings/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stripe_portal" }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else setMessage(json.error || "Stripe portal not configured");
  }

  const currentUsage = usage[0];
  const stripeConfigured = billing?.stripeConfigured ?? false;
  const balance = billing ? billing.balance : metrics?.balance ?? 0;

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Plan, credits, itemized estimate, ledger, and invoices."
        actions={
          <Button onClick={purchaseCredits} disabled={purchasing}>
            {purchasing ? "Processing…" : "Add credits"}
          </Button>
        }
      />

      <Tabs items={personalMode ? personalSettingsTabs : settingsTabs} />

      {metrics ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current plan"
            value={titleCasePlan(billing?.plan || "")}
            hint={stripeConfigured ? "Managed in Stripe" : "Workspace billing"}
          />
          <StatCard label="Credit balance" value={formatCurrency(balance)} />
          <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} />
          <StatCard
            label={personalMode ? "Forwarding minutes" : "Sent this period"}
            value={
              personalMode && forwardingMinutesUsed !== null
                ? `${forwardingMinutesUsed} min`
                : formatNumber(metrics.messagesSentPeriod)
            }
          />
        </div>
      ) : null}

      {personalMode ? (
        <p className="mb-6 text-sm text-muted-foreground">
          <Link href="/personal/usage" className="font-semibold text-primary hover:underline">
            View full usage breakdown
          </Link>
          {" "}
          for minutes, voicemail, and per-number limits.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Upcoming bill estimate</CardTitle>
          {estimate ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">Period {estimate.periodLabel}</p>
              <div className="space-y-2">
                {estimate.lineItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.label}</p>
                      {item.detail ? (
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 tabular-nums">{cents(item.amountCents)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{cents(estimate.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated tax</span>
                  <span>{cents(estimate.estimatedTaxCents)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Estimated total</span>
                  <span>{cents(estimate.totalCents)}</span>
                </div>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {estimate.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Loading estimate…</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>Payment method</CardTitle>
            <div className="mt-4 rounded-lg border border-border p-4">
              <p className="text-sm text-muted-foreground">
                {stripeConfigured
                  ? "Manage payment method, invoices, and subscription in the Stripe customer portal."
                  : "Stripe billing is not configured for this environment."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={openStripePortal}
              disabled={!stripeConfigured}
            >
              Stripe customer portal
            </Button>
          </Card>

          <Card>
            <CardTitle>Add credits</CardTitle>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="creditAmount">Amount (USD)</Label>
                <Input
                  id="creditAmount"
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  min={10}
                  step={5}
                  className="w-32"
                />
              </div>
              <Button type="button" onClick={purchaseCredits} disabled={purchasing}>
                Purchase credits
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {stripeConfigured
                ? "Redirects to Stripe Checkout to purchase prepaid messaging credits."
                : "Creates a credit ledger entry when Stripe billing is not configured."}
            </p>
          </Card>
        </div>
      </div>

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}

      <Card className="mt-4">
        <CardTitle>Credit ledger</CardTitle>
        {ledger.length === 0 ? (
          <EmptyState
            title="No ledger entries"
            description="Purchases, usage deductions, and adjustments appear here."
          />
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Description</th>
                  <th className="pb-2 pr-3 font-medium">Source</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{row.description}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.source}</td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        row.amountCents < 0 ? "text-rose-600" : "text-violet-700"
                      }`}
                    >
                      {row.amountCents >= 0 ? "+" : ""}
                      {cents(row.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Invoices</CardTitle>
        {!estimate?.invoices?.length ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {stripeConfigured
              ? "No Stripe invoices found for this customer yet."
              : "Connect Stripe to sync invoice history."}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {estimate.invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {inv.number || inv.id} · {inv.status || "unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.created * 1000).toLocaleDateString()} · due {cents(inv.amountDue)} ·
                    paid {cents(inv.amountPaid)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {inv.hostedInvoiceUrl ? (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </a>
                  ) : null}
                  {inv.pdf ? (
                    <a href={inv.pdf} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">
                        PDF
                      </Button>
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Usage periods</CardTitle>
        {usage.length === 0 ? (
          <EmptyState title="No usage records" description="Usage will appear here once you send messages." />
        ) : (
          <div className="mt-4 space-y-3">
            {usage.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(row.periodStart).toLocaleDateString()} –{" "}
                  {new Date(row.periodEnd).toLocaleDateString()}
                </span>
                <span>
                  {formatNumber(row.outbound)} outbound · {formatCurrency(row.costCents / 100)}
                </span>
              </div>
            ))}
          </div>
        )}
        {currentUsage ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {personalMode
              ? `Current period: ${forwardingMinutesUsed ?? 0} forwarding minutes on your Personal plan.`
              : `Current period: ${formatNumber(currentUsage.smsSegments)} SMS segments, ${formatNumber(currentUsage.mmsMessages)} MMS.`}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
