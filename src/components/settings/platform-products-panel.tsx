"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";
import type { ProductAccessStatus } from "@/lib/products/types";
import { isActiveEntitlement } from "@/lib/products/types";
import { PLATFORM_BILLING_CATALOG } from "@/lib/products/platform-billing-catalog";
import { useEffect, useState } from "react";

type FeatureSnapshot = Record<TransovoProductFeature, ProductAccessStatus>;

export function PlatformProductsPanel({
  highlightProduct,
}: {
  highlightProduct?: string | null;
}) {
  const [features, setFeatures] = useState<FeatureSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [trialKey, setTrialKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/platform/features")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setFeatures(j.data as FeatureSnapshot);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function startTrial(productKey: string) {
    setTrialKey(productKey);
    setMessage("");
    try {
      const res = await fetch("/api/platform/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Trial grant failed");
      const def = PLATFORM_BILLING_CATALOG.find((p) => p.productKey === productKey);
      setMessage(`Trial activated for ${def?.displayName || productKey}.`);
      const refresh = await fetch("/api/platform/features").then((r) => r.json());
      if (refresh.data) setFeatures(refresh.data as FeatureSnapshot);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Trial grant failed");
    } finally {
      setTrialKey(null);
    }
  }

  async function startCheckout(productKey: string) {
    setCheckoutKey(productKey);
    setMessage("");
    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.data?.url) {
        window.location.href = json.data.url;
        return;
      }
      setMessage("Checkout session created. Refresh if features did not update.");
      const refresh = await fetch("/api/platform/features").then((r) => r.json());
      if (refresh.data) setFeatures(refresh.data as FeatureSnapshot);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutKey(null);
    }
  }

  function statusForProduct(productKey: string): ProductAccessStatus {
    const def = PLATFORM_BILLING_CATALOG.find((p) => p.productKey === productKey);
    if (!def || !features) return "inactive";
    if (def.feature === "bundle_mctb_sr") {
      const mctb = isActiveEntitlement(features.mctb);
      const sr = isActiveEntitlement(features.smart_routing);
      return mctb && sr ? "active" : mctb || sr ? "trial" : "inactive";
    }
    const feat = def.feature as TransovoProductFeature;
    return features[feat] ?? "inactive";
  }

  return (
    <Card className="mt-4">
      <CardTitle>Platform products</CardTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        Missed Call Text Back, Smart Routing, bundles, and add-ons billed at the workspace level.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading products…</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLATFORM_BILLING_CATALOG.map((product) => {
            const status = statusForProduct(product.productKey);
            const active = status === "active";
            const highlighted = highlightProduct === product.productKey;
            return (
              <div
                key={product.productKey}
                className={`rounded-lg border p-4 ${
                  highlighted ? "border-indigo-400 bg-indigo-50/50" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{product.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      active
                        ? "bg-emerald-100 text-emerald-800"
                        : status === "trial"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {active ? "Active" : status === "trial" ? "Partial" : "Not subscribed"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold tabular-nums">
                  {formatCurrency(product.amountCents / 100)}
                  <span className="text-xs font-normal text-muted-foreground"> / month</span>
                </p>
                {!active ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={trialKey === product.productKey}
                      onClick={() => startTrial(product.productKey)}
                    >
                      {trialKey === product.productKey ? "Starting trial…" : "Try trial"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={checkoutKey === product.productKey}
                      onClick={() => startCheckout(product.productKey)}
                    >
                      {checkoutKey === product.productKey ? "Redirecting…" : "Subscribe"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </Card>
  );
}
