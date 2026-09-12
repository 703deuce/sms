"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoneyMinor } from "@/lib/payment-requests/format";
import { normalizeUserFacingStatus } from "@/lib/payment-requests/status";
import type { PaymentRequestView } from "@/lib/payment-requests/types";
import { RequestPaymentDrawer } from "@/components/payments/request-payment-drawer";
import { PaymentRequestDetailDrawer } from "@/components/payments/payment-request-detail-drawer";

type Props = {
  conversationId: string;
  phone: string;
  customerName: string;
  contactId?: string | null;
  missedCallId?: string | null;
  stripeConnected?: boolean;
};

export function ConversationPaymentActions({
  conversationId,
  phone,
  customerName,
  contactId,
  missedCallId,
  stripeConnected = true,
}: Props) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cards, setCards] = useState<PaymentRequestView[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/payment-requests/by-conversation/${conversationId}`);
    const json = await res.json();
    if (res.ok) setCards(json.data || []);
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const prefill = {
    conversationId,
    phone,
    customerName,
    contactId: contactId || "",
    missedCallId: missedCallId || "",
    sourceType: missedCallId ? "mctb_conversation" : "conversation",
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, padding: "8px 16px", borderTop: "1px solid #eee", flexWrap: "wrap" }}>
        <button
          type="button"
          className="payments-primary-btn"
          style={{ minWidth: 0, height: 34, fontSize: 12 }}
          onClick={() => setRequestOpen(true)}
        >
          Request payment
        </button>
      </div>

      {cards.length > 0 ? (
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {cards.map((card) => {
            const label = normalizeUserFacingStatus(card.status, card.deliveryStatus);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetailId(card.id)}
                style={{
                  textAlign: "left",
                  border: "1px solid #e8e8e6",
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: "#fff",
                  minHeight: 96,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "#6b7280" }}>PAYMENT REQUEST</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{formatMoneyMinor(card.amountMinor, card.currency)}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{card.description}</div>
                <div style={{ fontSize: 12, marginTop: 6, color: "#6b7280" }}>
                  {label === "Paid" ? "✓ Payment received" : "Awaiting payment"} · {label}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      <RequestPaymentDrawer
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        stripeConnected={stripeConnected}
        prefill={prefill}
        onSuccess={(id) => {
          setRequestOpen(false);
          setDetailId(id);
          void load();
        }}
      />
      <PaymentRequestDetailDrawer
        open={Boolean(detailId)}
        requestId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void load()}
      />
    </>
  );
}
