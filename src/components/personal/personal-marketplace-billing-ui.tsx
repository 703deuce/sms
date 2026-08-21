"use client";

import { useEffect, useState } from "react";
import { PersonalMockBtn, PersonalMockHeader, PersonalMockPage, PersonalMockPill, pm } from "@/components/personal/mockup/primitives";
import Link from "next/link";

type HistoryPayload = {
  numberPurchases: Array<{
    reservationId: string;
    phoneNumber: string;
    display: string;
    amountCents: number;
    paymentStatus: string;
    fulfillmentStatus: string;
    refundId?: string | null;
    purchasedAt: string;
  }>;
  serviceSubscriptions: Array<{
    service: string;
    displayName: string;
    phoneNumber: string;
    amountCents: number;
    status: string;
    currentPeriodEnd?: string | null;
  }>;
};

export function PersonalMarketplaceBillingUI() {
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/personal/billing/history");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load billing history");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load billing history");
      }
    })();
  }, []);

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Number Marketplace Billing"
        description="One-time number purchases and optional monthly services for each number."
        actions={
          <Link href="/personal/vault">
            <PersonalMockBtn variant="outline">Back to Vault</PersonalMockBtn>
          </Link>
        }
      />

      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={pm.card + " p-4"}>
          <h2 className="text-[15px] font-bold">Number purchases (one-time)</h2>
          <div className="mt-3 space-y-3">
            {(data?.numberPurchases ?? []).length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No number purchases yet.</p>
            ) : (
              data?.numberPurchases.map((row) => (
                <div key={row.reservationId} className="rounded-lg border border-[#e5e7eb] p-3">
                  <p className="font-semibold">{row.display}</p>
                  <p className="text-[13px] text-[#6b7280]">{row.phoneNumber}</p>
                  <p className="mt-1 text-[14px] font-bold">
                    ${(row.amountCents / 100).toFixed(2)} · one-time
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PersonalMockPill tone="blue">{row.paymentStatus}</PersonalMockPill>
                    <PersonalMockPill tone="gray">{row.fulfillmentStatus}</PersonalMockPill>
                    {row.refundId ? <PersonalMockPill tone="orange">Refunded</PersonalMockPill> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={pm.card + " p-4"}>
          <h2 className="text-[15px] font-bold">Service subscriptions</h2>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            Vault $2.99/mo · Voicemail $4.99/mo · Forwarding $9.99/mo (200 min/mo)
          </p>
          <div className="mt-3 space-y-3">
            {(data?.serviceSubscriptions ?? []).length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">No active subscriptions yet.</p>
            ) : (
              data?.serviceSubscriptions.map((row, idx) => (
                <div key={`${row.service}-${row.phoneNumber}-${idx}`} className="rounded-lg border border-[#e5e7eb] p-3">
                  <p className="font-semibold">{row.displayName}</p>
                  <p className="text-[13px] text-[#6b7280]">{row.phoneNumber}</p>
                  <p className="mt-1 text-[14px] font-bold">
                    ${(row.amountCents / 100).toFixed(2)}/month
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PersonalMockPill tone={row.status === "active" ? "green" : "gray"}>
                      {row.status}
                    </PersonalMockPill>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </PersonalMockPage>
  );
}
