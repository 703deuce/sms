"use client";

import { useEffect, useState } from "react";
import { X, Send, ExternalLink, RotateCcw, Link2 } from "lucide-react";
import {
  TransactionRow,
  formatMoney,
  formatWhen,
  appointmentHref,
  providerDashboardHref,
} from "../types";
import { StatusChip } from "./StatusChip";

const modeLabel: Record<string, string> = {
  booking: "Collected at booking",
  payment_link: "Payment link",
  deposit: "Deposit at booking",
};

export function TransactionDrawer({
  row,
  onClose,
  onRefund,
}: {
  row: TransactionRow | null;
  onClose: () => void;
  onRefund: (row: TransactionRow) => void;
}) {
  const [linkState, setLinkState] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (!row) return;
    setLinkState("idle");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;

  const balanceCents = row.totalPriceCents - row.amountPaidCents;
  const canRefund = row.amountPaidCents - row.refundAmountCents > 0;
  const providerName = row.provider === "stripe" ? "Stripe" : "Square";

  const sendPaymentLink = () => {
    setLinkState("sending");
    setTimeout(() => setLinkState("sent"), 800);
  };

  return (
    <>
      <div className="tv-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="tv-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Transaction ${row.id}`}
      >
        <div className="tv-drawer-head">
          <div>
            <p className="tv-eyebrow">Transaction</p>
            <h2 className="tv-drawer-title">
              {formatMoney(row.amountPaidCents || row.totalPriceCents, row.currency)}
            </h2>
          </div>
          <button className="tv-icon-btn" onClick={onClose} aria-label="Close transaction details">
            <X size={18} />
          </button>
        </div>

        <div className="tv-drawer-body">
          <div className="tv-drawer-status">
            <StatusChip status={row.status} />
            <span className="tv-provider-badge">{providerName}</span>
          </div>

          <section className="tv-detail-group">
            <h3 className="tv-detail-heading">Appointment</h3>
            <dl className="tv-detail-list">
              <div><dt>Service</dt><dd>{row.appointmentTitle}</dd></div>
              <div><dt>Customer</dt><dd>{row.customerName}</dd></div>
              <div><dt>Phone</dt><dd>{row.customerPhone}</dd></div>
              <div>
                <dt>Appointment</dt>
                <dd>
                  <a href={appointmentHref(row.appointmentId)} className="tv-link">
                    View appointment
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="tv-detail-group">
            <h3 className="tv-detail-heading">Payment</h3>
            <dl className="tv-detail-list">
              <div><dt>Method</dt><dd>{modeLabel[row.paymentMode] ?? row.paymentMode}</dd></div>
              <div><dt>Total</dt><dd className="tv-num">{formatMoney(row.totalPriceCents, row.currency)}</dd></div>
              <div><dt>Paid</dt><dd className="tv-num">{formatMoney(row.amountPaidCents, row.currency)}</dd></div>
              {balanceCents > 0 && row.status !== "failed" && (
                <div><dt>Balance due</dt><dd className="tv-num">{formatMoney(balanceCents, row.currency)}</dd></div>
              )}
              {row.refundAmountCents > 0 && (
                <div><dt>Refunded</dt><dd className="tv-num tv-refunded">−{formatMoney(row.refundAmountCents, row.currency)}</dd></div>
              )}
            </dl>
          </section>

          {/* Contextual actions by transaction state */}
          {(row.status === "pending" || row.status === "failed" || (row.paymentMode === "deposit" && balanceCents > 0)) && (
            <section className="tv-detail-group">
              <h3 className="tv-detail-heading">Collect payment</h3>
              {row.status === "pending" && (
                <p className="tv-drawer-note">
                  A payment link for {formatMoney(row.totalPriceCents, row.currency)} was sent to{" "}
                  {row.customerName} but hasn’t been paid yet.
                </p>
              )}
              {row.status === "failed" && (
                <p className="tv-drawer-note">
                  The charge was declined by the card issuer. Send a new payment link so the customer
                  can pay with a different card.
                </p>
              )}
              {row.paymentMode === "deposit" && balanceCents > 0 && row.status !== "failed" && (
                <p className="tv-drawer-note">
                  A {formatMoney(row.amountPaidCents, row.currency)} deposit was collected at booking.
                  The remaining balance is due before the appointment.
                </p>
              )}
              <button
                className="tv-btn tv-btn-secondary tv-btn-block"
                onClick={sendPaymentLink}
                disabled={linkState !== "idle"}
              >
                {linkState === "sent" ? (
                  <>Payment link sent to {row.customerPhone}</>
                ) : linkState === "sending" ? (
                  <>Sending…</>
                ) : (
                  <>
                    {row.status === "pending" ? <Send size={14} /> : <Link2 size={14} />}
                    {row.status === "pending"
                      ? "Resend payment link"
                      : row.status === "failed"
                        ? "Send new payment link"
                        : `Send balance link — ${formatMoney(balanceCents, row.currency)}`}
                  </>
                )}
              </button>
            </section>
          )}

          <section className="tv-detail-group">
            <h3 className="tv-detail-heading">Activity</h3>
            <ul className="tv-timeline">
              <li>
                <span className="tv-tl-dot tv-tl-neutral" />
                <div>
                  <p className="tv-tl-title">Payment created</p>
                  <p className="tv-tl-time">{formatWhen(row.createdAt)}</p>
                </div>
              </li>
              {row.paidAt && (
                <li>
                  <span className="tv-tl-dot tv-tl-success" />
                  <div>
                    <p className="tv-tl-title">Payment received via {providerName}</p>
                    <p className="tv-tl-time">{formatWhen(row.paidAt)}</p>
                  </div>
                </li>
              )}
              {row.refundAmountCents > 0 && (
                <li>
                  <span className="tv-tl-dot tv-tl-warning" />
                  <div>
                    <p className="tv-tl-title">Refund issued — {formatMoney(row.refundAmountCents, row.currency)}</p>
                    <p className="tv-tl-time">{formatWhen(row.paidAt)}</p>
                  </div>
                </li>
              )}
              {row.status === "pending" && (
                <li>
                  <span className="tv-tl-dot tv-tl-neutral" />
                  <div>
                    <p className="tv-tl-title">Awaiting customer payment</p>
                    <p className="tv-tl-time">Payment link sent — not yet paid</p>
                  </div>
                </li>
              )}
              {row.status === "failed" && (
                <li>
                  <span className="tv-tl-dot tv-tl-danger" />
                  <div>
                    <p className="tv-tl-title">Payment failed</p>
                    <p className="tv-tl-time">The charge was declined by the card issuer.</p>
                  </div>
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className="tv-drawer-foot">
          {canRefund ? (
            <button className="tv-btn tv-btn-danger-outline" onClick={() => onRefund(row)}>
              <RotateCcw size={14} /> Refund
            </button>
          ) : (
            <a href={appointmentHref(row.appointmentId)} className="tv-btn tv-btn-secondary">
              View appointment
            </a>
          )}
          <a
            href={providerDashboardHref(row.provider, row.id)}
            target="_blank"
            rel="noreferrer"
            className="tv-btn tv-btn-ghost"
          >
            Open in {providerName} <ExternalLink size={13} />
          </a>
        </div>
      </aside>
    </>
  );
}
