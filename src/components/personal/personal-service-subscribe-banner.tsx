"use client";

import type { MarketplaceServiceKey } from "@/lib/payments/stripe-marketplace-metadata";
import { useCallback, useEffect, useState } from "react";
import { PersonalMockBtn, PersonalMockPill, pm } from "./mockup/primitives";

type CatalogRow = {
  productKey: MarketplaceServiceKey;
  displayName: string;
  description?: string | null;
  amountCents: number;
  includedUsageMinutes?: number | null;
  monthlyPriceLabel: string;
};

type SubscriptionRow = {
  service: MarketplaceServiceKey;
  status: string;
  active: boolean;
  currentPeriodEnd?: string | null;
};

const SERVICE_COPY: Record<
  MarketplaceServiceKey,
  { title: string; detail?: string }
> = {
  vault: { title: "Vault", detail: "Secure number parking" },
  voicemail: { title: "Voicemail", detail: "Voicemail for this number" },
  forwarding_200: {
    title: "Call Forwarding",
    detail: "Includes 200 forwarding minutes/month",
  },
};

export function PersonalServiceSubscribeBanner({
  phoneNumberId,
  service,
  workspaceId,
}: {
  phoneNumberId: string;
  service: MarketplaceServiceKey;
  workspaceId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [catalogRow, setCatalogRow] = useState<CatalogRow | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ phoneNumberId });
      if (workspaceId) params.set("workspaceId", workspaceId);
      const res = await fetch(`/api/personal/billing/subscriptions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load billing status");
      const cat = (data.catalog as CatalogRow[] | undefined)?.find((c) => c.productKey === service) ?? null;
      const sub =
        (data.subscriptions as SubscriptionRow[] | undefined)?.find((s) => s.service === service) ??
        null;
      setCatalogRow(cat);
      setSubscription(sub);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load billing status");
    } finally {
      setLoading(false);
    }
  }, [phoneNumberId, service, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className={pm.card}>
        <p className="text-[13px] text-[#6b7280]">Checking subscription…</p>
      </div>
    );
  }

  if (subscription?.active) {
    return (
      <div className={pm.card}>
        <div className="flex flex-wrap items-center gap-2">
          <PersonalMockPill tone="green">{SERVICE_COPY[service].title} active</PersonalMockPill>
          <span className="text-[13px] text-[#6b7280]">
            {catalogRow?.monthlyPriceLabel ?? ""}
            {subscription.currentPeriodEnd
              ? ` · renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
              : ""}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={pm.card}>
      <p className="text-[14px] font-semibold text-[#111827]">
        Subscribe to {SERVICE_COPY[service].title}
      </p>
      <p className="mt-1 text-[13px] text-[#6b7280]">
        {SERVICE_COPY[service].detail ?? catalogRow?.description}
      </p>
      <p className="mt-2 text-[18px] font-bold text-[#111827]">
        {catalogRow?.monthlyPriceLabel ?? "Monthly plan"}
      </p>
      {service === "forwarding_200" ? (
        <p className="mt-1 text-[12px] text-[#6b7280]">200 minutes/month included. No overage billing yet.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <PersonalMockBtn
          disabled={busy || !phoneNumberId}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await fetch("/api/personal/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId,
                  phoneNumberId,
                  service,
                }),
              });
              const data = await res.json();
              if (!res.ok || !data.checkoutUrl) {
                throw new Error(data.error || "Checkout failed");
              }
              window.location.href = data.checkoutUrl;
            } catch (err) {
              setError(err instanceof Error ? err.message : "Checkout failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Redirecting…" : `Subscribe — ${catalogRow?.monthlyPriceLabel ?? ""}`}
        </PersonalMockBtn>
      </div>
      {error ? <p className="mt-2 text-[13px] text-red-600">{error}</p> : null}
    </div>
  );
}
