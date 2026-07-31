"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useEffect, useState } from "react";

const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Users", href: "/settings/users" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Limits", href: "/settings/limits" },
  { label: "Security", href: "/settings/security" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Data", href: "/settings/data" },
];

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

function titleCasePlan(plan: string) {
  if (!plan) return "—";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function BillingSettingsPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [creditAmount, setCreditAmount] = useState(50);
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState("");

  function applyData(data: { metrics?: Metrics; usage?: UsageRow[]; billing?: Billing }) {
    if (data.metrics) setMetrics(data.metrics);
    setUsage(data.usage || []);
    if (data.billing) setBilling(data.billing);
  }

  useEffect(() => {
    fetch("/api/settings/billing")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) applyData(j.data);
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
        description="Plan, credits, payment method, and invoice history."
        actions={
          <Button onClick={purchaseCredits} disabled={purchasing}>
            {purchasing ? "Processing…" : "Add credits"}
          </Button>
        }
      />

      <Tabs items={settingsTabs} />

      {metrics ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current plan"
            value={titleCasePlan(billing?.plan || "")}
            hint={stripeConfigured ? "Managed in Stripe" : "Workspace billing"}
          />
          <StatCard label="Credit balance" value={formatCurrency(balance)} />
          <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} />
          <StatCard label="Sent this period" value={formatNumber(metrics.messagesSentPeriod)} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
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

      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}

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
                  {new Date(row.periodStart).toLocaleDateString()} – {new Date(row.periodEnd).toLocaleDateString()}
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
            Current period: {formatNumber(currentUsage.smsSegments)} SMS segments, {formatNumber(currentUsage.mmsMessages)} MMS.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
