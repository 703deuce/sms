"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type BillingSummary = {
  lifecycleState: string;
  billingModel: string | null;
  monthlyPlanTier: string | null;
  monthlySegmentsIncluded: number;
  monthlySegmentsRemaining: number;
  monthlySegmentsUsed: number;
  paygCreditsSegments: number;
  paygLineActive: boolean;
  a2pFeeStatus: string;
  trialSegmentsUsed: number;
  trialSegmentsRemaining: number;
  trialEndsAt: string | null;
  canSend: boolean;
  blockReason: string | null;
};

export function MassTextingBillingPanel() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mass-texting/billing")
      .then((r) => r.json())
      .then((json) => {
        setSummary(json.data?.summary ?? null);
      })
      .catch(() => setError("Could not load billing"))
      .finally(() => setLoading(false));
  }, []);

  async function startCheckout(productKey: string) {
    setCheckoutLoading(productKey);
    setError(null);
    try {
      const res = await fetch("/api/mass-texting/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      window.location.href = json.data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setCheckoutLoading(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading Mass Texting billing…</p>;
  if (!summary) return <p className="text-sm text-rose-600">{error || "Billing unavailable"}</p>;

  return (
    <section className="rounded-[14px] border border-border bg-card p-5">
      <h2 className="text-[16px] font-semibold">Mass Texting billing</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Status: <span className="font-medium text-foreground">{summary.lifecycleState}</span>
        {summary.blockReason ? ` — ${summary.blockReason}` : ""}
      </p>

      <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Monthly segments remaining</dt>
          <dd className="font-semibold">{summary.monthlySegmentsRemaining}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">PAYG credits</dt>
          <dd className="font-semibold">{summary.paygCreditsSegments}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trial segments remaining</dt>
          <dd>{summary.trialSegmentsRemaining}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">A2P fee status</dt>
          <dd>{summary.a2pFeeStatus}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">PAYG line</dt>
          <dd>{summary.paygLineActive ? "Active" : "Inactive"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plan</dt>
          <dd>{summary.monthlyPlanTier || summary.billingModel || "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={checkoutLoading !== null}
          onClick={() => startCheckout("mass_texting_growth")}
        >
          {checkoutLoading === "mass_texting_growth" ? "Redirecting…" : "Upgrade to Growth"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checkoutLoading !== null}
          onClick={() => startCheckout("mass_texting_pack_1000")}
        >
          Buy 1,000 credits
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checkoutLoading !== null}
          onClick={() => startCheckout("mass_texting_payg_line")}
        >
          Start PAYG line
        </Button>
      </div>

      {error ? <p className="mt-2 text-[13px] text-rose-600">{error}</p> : null}
    </section>
  );
}
