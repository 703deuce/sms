"use client";

import { useEffect, useState } from "react";
import type { Billing, Estimate, LedgerEntry, Metrics, UsageRow } from "@/components/settings/kimi-ui/billing/types";
import { formatCurrency } from "@/components/settings/kimi-ui/billing/types";
import { EmptyState, Panel, Pill, Stat } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
import { AlertTriangle, CreditCard } from "lucide-react";

type Props = { highlightProduct?: string | null };

export function BillingSettingsOpus({ highlightProduct }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [creditAmount, setCreditAmount] = useState(50);
  const [purchasing, setPurchasing] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    fetch("/api/settings/billing")
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) {
          setFailed(true);
          return;
        }
        const d = j.data;
        if (d.metrics) setMetrics(d.metrics);
        setUsage(d.usage || []);
        if (d.billing) setBilling(d.billing);
        if (d.ledger) setLedger(d.ledger);
        if (d.estimate) setEstimate(d.estimate);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function openStripePortal() {
    const res = await fetch("/api/settings/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stripe_portal" }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else setMessage({ text: json.error || "Stripe portal not configured", kind: "error" });
  }

  async function purchaseCredits() {
    setPurchasing(true);
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
      setMessage({ text: `Added ${formatCurrency(creditAmount)} in credits.`, kind: "success" });
      load();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Purchase failed", kind: "error" });
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>;
  }

  if (failed || !metrics || !billing) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Billing couldn't be loaded"
        description="Try loading it again."
        action={<Button type="button" variant="outline" onClick={load}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {highlightProduct ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
          Review billing for {highlightProduct.replace(/_/g, " ")}.
        </p>
      ) : null}
      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${message.kind === "success" ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Credit balance" value={formatCurrency(metrics.balance)} hint={`${metrics.creditsRemaining} credits`} />
        <Stat label="Messages (period)" value={String(metrics.messagesSentPeriod)} hint="Outbound usage" />
        <Stat label="Plan" value={billing.plan} hint={billing.stripeConfigured ? "Stripe subscription" : "Workspace billing"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Credits & payment" description="Purchase credits and manage payment method in Stripe.">
          <p className="text-sm text-muted-foreground">
            {billing.stripeConfigured ? (
              <Pill tone="success">Stripe connected</Pill>
            ) : (
              <Pill tone="neutral">Workspace billing</Pill>
            )}
          </p>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="credit-amt">Purchase amount (USD)</Label>
            <Input
              id="credit-amt"
              type="number"
              min={5}
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={purchasing} onClick={() => void purchaseCredits()}>
              <CreditCard className="mr-2 size-4" aria-hidden />
              {purchasing ? "Processing…" : "Buy credits"}
            </Button>
            {billing.stripeConfigured ? (
              <Button type="button" variant="outline" onClick={() => void openStripePortal()}>
                Open Stripe portal
              </Button>
            ) : null}
          </div>
        </Panel>

        {estimate ? (
          <Panel title="Current estimate" description={estimate.periodLabel}>
            <ul className="space-y-2 text-sm">
              {estimate.lineItems.map((line) => (
                <li key={line.id} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(line.amountCents / 100)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-semibold tabular-nums">
              Total {formatCurrency(estimate.totalCents / 100)}
            </p>
          </Panel>
        ) : null}
      </div>

      <Panel title="Usage by period">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Outbound</TableHead>
              <TableHead>Segments</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usage.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">
                  {new Date(row.periodStart).toLocaleDateString()} – {new Date(row.periodEnd).toLocaleDateString()}
                </TableCell>
                <TableCell>{row.outbound}</TableCell>
                <TableCell>{row.smsSegments}</TableCell>
                <TableCell>{formatCurrency(row.costCents / 100)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ledger">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(entry.amountCents / 100)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        {estimate ? (
          <Panel title="Invoices">
            {estimate.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {estimate.invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
                    <span>{inv.number || inv.id}</span>
                    {inv.hostedInvoiceUrl ? (
                      <a className="text-primary hover:underline" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{inv.status}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
