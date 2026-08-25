"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

type BillingSnapshot = {
  tier: string;
  monthlyPriceCents: number;
  includedPages: number;
  overageRateCents: number;
  includedFaxNumbers: number;
  pagesUsed: number;
  pagesRemaining: number;
  faxNumber: string | null;
  subscriptionStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

export function FaxBillingPanel() {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/fax/billing")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setBilling(j.data);
      })
      .catch(() => undefined);
  }, []);

  async function cancelPlan() {
    const ok = window.confirm(
      "Cancel your fax subscription at the end of this billing period? Your fax number stays active until then. Historical records remain available.",
    );
    if (!ok) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/fax/billing/cancel", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancellation failed");
      setMessage(json.data?.message || "Cancellation scheduled.");
      const refresh = await fetch("/api/fax/billing").then((r) => r.json());
      if (refresh.data) setBilling(refresh.data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setLoading(false);
    }
  }

  async function requestPortOut() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/fax/port-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Port-out request failed");
      setMessage(
        `Port-out requested for ${json.data.e164}. Status: ${json.data.status}. Our team will provide LOA documentation.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Port-out request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!billing) return <p className="text-sm text-muted-foreground">Loading billing…</p>;

  const periodEnd = billing.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString()
    : "end of billing period";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h2 className="font-semibold">Plan & usage</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Monthly price" value={formatCurrency(billing.monthlyPriceCents / 100)} />
          <Row label="Included pages" value={String(billing.includedPages)} />
          <Row label="Overage rate" value={`${formatCurrency(billing.overageRateCents / 100)}/page`} />
          <Row label="Fax numbers included" value={String(billing.includedFaxNumbers)} />
          <Row label="Pages used" value={String(billing.pagesUsed)} />
          <Row label="Pages remaining" value={String(billing.pagesRemaining)} />
          <Row label="Fax number" value={billing.faxNumber || "Not provisioned"} />
        </dl>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="font-semibold">Manage plan</h2>
        {billing.cancelAtPeriodEnd ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your plan will remain active until {periodEnd}. Your fax number remains active until{" "}
            {periodEnd}. Received documents and historical records stay available. You may request
            port-out before release.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Cancel anytime — no support ticket required. Your fax number stays active until{" "}
              {periodEnd}.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={cancelPlan}
              className="mt-4 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              Cancel subscription
            </button>
          </>
        )}
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="font-semibold">Port my fax number out</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your Transovo fax number is a real business phone number assigned to your account. You may
          request to port it to another provider subject to normal carrier requirements. Transovo
          does not charge arbitrary port-out fees.
        </p>
        <button
          type="button"
          disabled={loading || !billing.faxNumber}
          onClick={requestPortOut}
          className="mt-4 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Request port-out
        </button>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
