"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";
import type { ProductAccessStatus } from "@/lib/products/types";
import { isActiveEntitlement } from "@/lib/products/types";
import {
  BUNDLE_PRICING_MATRIX,
  bundleMonthlyTotalCents,
} from "@/lib/products/platform-bundle-pricing";
import type { MctbTier, SmartRoutingTier, AiTranscriptionTier } from "@/lib/products/platform-billing-catalog-definitions";
import { MCTB_OWN_NUMBER_STACKING_SUMMARY } from "@/lib/mctb/commercial-pricing";
import { useEffect, useMemo, useState } from "react";

type FeatureSnapshot = Record<TransovoProductFeature, ProductAccessStatus>;

type CatalogProduct = {
  productKey: string;
  family: string;
  tier?: string;
  displayName: string;
  description: string;
  amountCents: number;
  includedMinutes?: number;
  feature: TransovoProductFeature;
};

type PlatformSub = {
  productFamily: string;
  tier: string;
  status: string;
  minutesUsedThisPeriod?: number;
  includedMinutes?: number | null;
};

export function PlatformProductsPanel({
  highlightProduct,
}: {
  highlightProduct?: string | null;
}) {
  const [features, setFeatures] = useState<FeatureSnapshot | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [subscriptions, setSubscriptions] = useState<PlatformSub[]>([]);
  const [dualDiscountActive, setDualDiscountActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [trialKey, setTrialKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selectedMctb, setSelectedMctb] = useState<MctbTier>("text_back");
  const [selectedSr, setSelectedSr] = useState<SmartRoutingTier>("starter");
  const [selectedAt, setSelectedAt] = useState<AiTranscriptionTier>("starter");

  async function refresh() {
    const [featRes, catRes] = await Promise.all([
      fetch("/api/platform/features"),
      fetch("/api/platform/billing/catalog"),
    ]);
    const featJson = await featRes.json();
    const catJson = await catRes.json();
    if (featJson.data) setFeatures(featJson.data as FeatureSnapshot);
    if (catJson.data) {
      setProducts(catJson.data.products as CatalogProduct[]);
      setSubscriptions(catJson.data.subscriptions as PlatformSub[]);
      setDualDiscountActive(Boolean(catJson.data.dualDiscountActive));
    }
  }

  useEffect(() => {
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const mctbProducts = products.filter((p) => p.family === "mctb");
  const mctbAddonProducts = products.filter(
    (p) => p.family === "mctb_ai_recovery" || p.family === "mctb_own_sender",
  );
  const srProducts = products.filter((p) => p.family === "smart_routing");
  const cfProducts = products.filter((p) => p.family === "call_forwarding");
  const atProducts = products.filter((p) => p.family === "ai_transcription");
  const faxProducts = products.filter((p) => p.family === "fax");
  const addonProducts = products.filter((p) => p.family === "addon");

  const resolvedHighlight =
    highlightProduct === "call_forwarding"
      ? cfProducts[0]?.productKey ?? highlightProduct
      : highlightProduct;

  const preview = useMemo(() => {
    const bothSelected = Boolean(selectedMctb && selectedSr);
    if (!bothSelected) return null;
    return bundleMonthlyTotalCents(selectedMctb, selectedSr, true);
  }, [selectedMctb, selectedSr]);

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
      setMessage(`Trial activated.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Trial grant failed");
    } finally {
      setTrialKey(null);
    }
  }

  async function startCheckout(productKey: string, nextProductKey?: string) {
    setCheckoutKey(productKey);
    setMessage("");
    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey, nextProductKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.data?.url) {
        window.location.href = json.data.url;
        return;
      }
      setMessage("Checkout session created.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckoutKey(null);
    }
  }

  function activeTier(family: string): string | null {
    const sub = subscriptions.find(
      (s) => s.productFamily === family && ["active", "trialing", "past_due"].includes(s.status),
    );
    return sub?.tier ?? null;
  }

  function featureActive(feature: TransovoProductFeature): boolean {
    return isActiveEntitlement(features?.[feature] ?? "inactive");
  }

  function renderTierColumn(
    title: string,
    family: string,
    items: CatalogProduct[],
    selected: string,
    onSelect: (tier: string) => void,
  ) {
    const active = activeTier(family);
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {items.map((product) => {
          const tier = product.tier || "";
          const isActive = active === tier;
          const highlighted = resolvedHighlight === product.productKey;
          return (
            <div
              key={product.productKey}
              className={`rounded-lg border p-4 ${
                highlighted ? "border-indigo-400 bg-indigo-50/50" : "border-border"
              } ${selected === tier ? "ring-2 ring-indigo-300" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{product.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
                  {product.includedMinutes ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.includedMinutes.toLocaleString()} included minutes / month
                    </p>
                  ) : null}
                </div>
                {isActive ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    Active
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold tabular-nums">
                {formatCurrency(product.amountCents / 100)}
                <span className="text-xs font-normal text-muted-foreground"> / month</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelect(tier)}
                  disabled={isActive}
                >
                  {selected === tier ? "Selected" : "Select"}
                </Button>
                {!isActive ? (
                  <Button
                    size="sm"
                    disabled={checkoutKey === product.productKey}
                    onClick={() => startCheckout(product.productKey)}
                  >
                    Subscribe
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardTitle>Platform products</CardTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        V1 launch products: Missed Call Text Back and Fax. Subscribe to both MCTB + Smart Routing and save 20% when Smart Routing returns.
      </p>
      {dualDiscountActive ? (
        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          20% multi-product discount active on your subscriptions.
        </p>
      ) : (
        <p className="mt-2 rounded-md bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900">
          Add both products and save 20%
        </p>
      )}
      {preview ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Selected bundle preview:{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatCurrency(preview.totalCents / 100)}/mo
          </span>{" "}
          (was {formatCurrency(preview.subtotalCents / 100)})
        </p>
      ) : null}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading products…</p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {renderTierColumn(
            "Missed Call Text Back",
            "mctb",
            mctbProducts,
            selectedMctb,
            (t) => setSelectedMctb(t as MctbTier),
          )}
          {srProducts.length > 0
            ? renderTierColumn(
                "Smart Routing",
                "smart_routing",
                srProducts,
                selectedSr,
                (t) => setSelectedSr(t as SmartRoutingTier),
              )
            : null}
        </div>
      )}
      {!loading && cfProducts.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Call Forwarding
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            One business number, one destination. Rings your existing phone — no app required for inbound calls.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {cfProducts.map((product) => {
              const isActive = activeTier("call_forwarding") === product.tier;
              return (
                <div key={product.productKey} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{product.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    {formatCurrency(product.amountCents / 100)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    {!isActive ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trialKey === product.productKey}
                          onClick={() => startTrial(product.productKey)}
                        >
                          Trial
                        </Button>
                        <Button
                          size="sm"
                          disabled={checkoutKey === product.productKey}
                          onClick={() => startCheckout(product.productKey)}
                        >
                          Subscribe
                        </Button>
                      </>
                    ) : (
                      <span className="text-sm text-emerald-700 font-medium">Active</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {!loading && atProducts.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AI Transcription
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn recorded calls and voicemails into searchable, readable transcripts. AI summaries
            included. Call recording is included with Smart Routing — transcription is optional.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {atProducts.map((product) => {
              const tier = product.tier || "";
              const isActive = activeTier("ai_transcription") === tier;
              const highlighted = resolvedHighlight === product.productKey;
              return (
                <div
                  key={product.productKey}
                  className={`rounded-lg border p-4 ${
                    highlighted ? "border-indigo-400 bg-indigo-50/50" : "border-border"
                  } ${selectedAt === tier ? "ring-2 ring-indigo-300" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium capitalize">{tier}</p>
                      {product.includedMinutes ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.includedMinutes.toLocaleString()} transcription minutes / month
                        </p>
                      ) : null}
                    </div>
                    {isActive ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    {formatCurrency(product.amountCents / 100)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedAt(tier as AiTranscriptionTier)}
                      disabled={isActive}
                    >
                      {selectedAt === tier ? "Selected" : "Select"}
                    </Button>
                    {!isActive ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={trialKey === product.productKey}
                          onClick={() => startTrial(product.productKey)}
                        >
                          Trial
                        </Button>
                        <Button
                          size="sm"
                          disabled={checkoutKey === product.productKey}
                          onClick={() => startCheckout(product.productKey)}
                        >
                          Subscribe
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {!loading && faxProducts.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Transovo Fax
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Reliable online fax with transparent page accounting. Manage or cancel your plan anytime.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {faxProducts.map((product) => {
              const isActive = activeTier("fax") === product.tier;
              return (
                <div key={product.productKey} className="rounded-lg border border-border p-4">
                  <p className="font-medium capitalize">{product.tier}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    {formatCurrency(product.amountCents / 100)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isActive ? (
                      <Button
                        size="sm"
                        disabled={checkoutKey === product.productKey}
                        onClick={() => startCheckout(product.productKey)}
                      >
                        Subscribe
                      </Button>
                    ) : (
                      <a
                        href="/fax/billing"
                        className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      >
                        Manage plan
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {!featureActive("mctb") && !featureActive("smart_routing") && preview ? (
        <div className="mt-4">
          <Button
            onClick={() =>
              startCheckout(`mctb_${selectedMctb}`, `smart_routing_${selectedSr}`)
            }
            disabled={Boolean(checkoutKey)}
          >
            Subscribe to both (20% off second checkout step)
          </Button>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Additional Smart Routing minutes above your plan: $0.02 / conversation minute.
      </p>
      {mctbAddonProducts.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Missed Call Text Back add-ons
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{MCTB_OWN_NUMBER_STACKING_SUMMARY}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mctbAddonProducts.map((product) => {
              const family = product.family;
              const isActive = subscriptions.some(
                (s) =>
                  s.productFamily === family &&
                  ["active", "trialing", "past_due"].includes(s.status),
              );
              const oneTime =
                product.oneTimeAmountCents != null
                  ? formatCurrency(product.oneTimeAmountCents / 100)
                  : null;
              return (
                <div key={product.productKey} className="rounded-lg border border-border p-4">
                  <p className="font-medium">{product.displayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
                  <p className="mt-3 text-sm font-semibold tabular-nums">
                    {formatCurrency(product.amountCents / 100)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                    {oneTime ? (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        + {oneTime} one-time A2P registration at checkout
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {!isActive ? (
                      <Button
                        size="sm"
                        disabled={checkoutKey === product.productKey}
                        onClick={() => startCheckout(product.productKey)}
                      >
                        Subscribe
                      </Button>
                    ) : (
                      <span className="text-sm font-medium text-emerald-700">Active</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {addonProducts.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {addonProducts.map((product) => (
            <div key={product.productKey} className="rounded-lg border p-4">
              <p className="font-medium">{product.displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{product.description}</p>
              <p className="mt-2 text-sm font-semibold">
                {formatCurrency(product.amountCents / 100)}/mo
              </p>
              <Button
                size="sm"
                className="mt-2"
                disabled={checkoutKey === product.productKey}
                onClick={() => startCheckout(product.productKey)}
              >
                Subscribe
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      <details className="mt-4 text-xs text-muted-foreground">
        <summary>Bundle pricing matrix (20% off)</summary>
        <ul className="mt-2 space-y-1">
          {BUNDLE_PRICING_MATRIX.map((row) => (
            <li key={`${row.mctbTier}-${row.srTier}`}>
              MCTB {row.mctbTier} + SR {row.srTier} → ${row.expectedTotalDollars.toFixed(2)}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
