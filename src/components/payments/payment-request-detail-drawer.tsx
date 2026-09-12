"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoneyMinor, formatPhoneDisplay } from "@/lib/payment-requests/format";
import { normalizeUserFacingStatus } from "@/lib/payment-requests/status";
import type { PaymentRequestDetailView } from "@/lib/payment-requests/types";

type Props = {
  open: boolean;
  requestId: string | null;
  onClose: () => void;
  onChanged: () => void;
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function eventLabel(type: string) {
  const map: Record<string, string> = {
    request_created: "Request created",
    checkout_created: "Checkout created",
    checkout_failed: "Checkout failed",
    sms_sent: "Text sent",
    sms_failed: "Text failed to send",
    sms_retry: "Text resent",
    reminder_sent: "Reminder sent",
    link_opened: "Link opened",
    payment_received: "Payment received",
    cancelled: "Cancelled",
  };
  return map[type] || type;
}

export function PaymentRequestDetailDrawer({ open, requestId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<PaymentRequestDetailView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!open || !requestId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    void fetch(`/api/payment-requests/${requestId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) throw new Error(json.error || "Not found");
        setDetail(json.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"))
      .finally(() => setLoading(false));
  }, [open, requestId]);

  const act = async (path: string) => {
    if (!requestId) return;
    const res = await fetch(`/api/payment-requests/${requestId}/${path}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Action failed");
    const refreshed = await fetch(`/api/payment-requests/${requestId}`).then((r) => r.json());
    setDetail(refreshed.data);
    onChanged();
  };

  if (!open) return null;

  const statusLabel = detail
    ? normalizeUserFacingStatus(detail.status, detail.deliveryStatus)
    : "";

  return (
    <>
      <div className="payments-drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="payments-drawer" style={{ width: "min(700px, 100vw)" }} role="dialog" aria-modal="true" aria-label="Payment request detail">
        <div className="payments-drawer-header">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Payment request</h2>
              {detail ? (
                <p style={{ margin: "6px 0 0", fontSize: 14 }}>
                  {formatMoneyMinor(detail.amountMinor, detail.currency)} · {detail.description}
                </p>
              ) : null}
            </div>
            {detail ? <span className="payments-status payments-status--paid" style={{ alignSelf: "flex-start" }}>{statusLabel}</span> : null}
          </div>
        </div>

        <div className="payments-drawer-body">
          {loading ? <p>Loading…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {detail ? (
            <>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700 }}>{detail.customerName || formatPhoneDisplay(detail.customerPhoneE164)}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{formatPhoneDisplay(detail.customerPhoneE164)}</div>
                {detail.conversationId ? (
                  <Link href={`/inbox?conversation=${detail.conversationId}`} style={{ fontSize: 13, fontWeight: 600 }}>
                    Open conversation →
                  </Link>
                ) : null}
              </div>

              <div className="payments-field-label">Activity</div>
              <div style={{ marginBottom: 20, paddingLeft: 8, borderLeft: "2px solid #e5e7eb" }}>
                {detail.events.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                    <span>✓ {eventLabel(ev.eventType)}</span>
                    <span style={{ color: "#9ca3af" }}>{fmtTime(ev.createdAt)}</span>
                  </div>
                ))}
              </div>

              <div className="payments-field-label">Details</div>
              <dl style={{ fontSize: 13, display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 12px" }}>
                <dt>Processor</dt><dd>Stripe</dd>
                <dt>Source</dt><dd>{detail.sourceType}</dd>
                <dt>Created</dt><dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                <dt>Expires</dt><dd>{detail.expiresAt ? new Date(detail.expiresAt).toLocaleString() : "Never"}</dd>
              </dl>

              {detail.smsError ? (
                <p role="alert" style={{ color: "#b45309", fontSize: 13, marginTop: 12 }}>
                  {detail.smsError}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {detail ? (
          <div className="payments-drawer-footer">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(detail.publicUrl);
              }}
            >
              Copy link
            </button>
            {detail.status !== "paid" && detail.status !== "cancelled" ? (
              <>
                <button type="button" onClick={() => void act("reminder").catch((e) => setError(String(e)))}>Send reminder</button>
                {detail.smsError ? (
                  <button type="button" onClick={() => void act("retry-message").catch((e) => setError(String(e)))}>Retry text</button>
                ) : null}
                <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>…</button>
                {menuOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Cancel payment request? The customer will no longer be able to use this payment request.")) {
                        void act("cancel").catch((e) => setError(String(e)));
                      }
                    }}
                  >
                    Cancel request
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
