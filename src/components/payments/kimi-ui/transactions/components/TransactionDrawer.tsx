"use client";

import { useEffect } from "react";
import { X, ExternalLink, RotateCcw } from "lucide-react";
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
  useEffect(() => {
    if (!row) return;
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
  const methodLabel = row.paymentMethodLabel || providerName;

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
            <span className="tv-provider-badge">{row.source}</span>
          </div>

          <section className="tv-detail-group">
            <h3 className="tv-detail-heading">Summary</h3>
            <dl className="tv-detail-list">
              <div><dt>Customer</dt><dd>{row.customerName}</dd></div>
              <div><dt>Description</dt><dd>{row.appointmentTitle}</dd></div>
              <div><dt>Date</dt><dd>{formatWhen(row.paidAt || row.createdAt)}</dd></div>
            </dl>
          </section>

          <section className="tv-detail-group">
            <h3 className="tv-detail-heading">Payment</h3>
            <dl className="tv-detail-list">
              <div><dt>Method</dt><dd>{methodLabel}</dd></div>
              <div><dt>Provider</dt><dd>{providerName}</dd></div>
              <div><dt>Mode</dt><dd>{modeLabel[row.paymentMode] ?? row.paymentMode}</dd></div>
              <div><dt>Total</dt><dd className="tv-num">{formatMoney(row.totalPriceCents, row.currency)}</dd></div>
              <div><dt>Paid</dt><dd className="tv-num">{formatMoney(row.amountPaidCents, row.currency)}</dd></div>
              {balanceCents > 0 && row.status !== "failed" && (
                <div><dt>Balance due</dt><dd className="tv-num">{formatMoney(balanceCents, row.currency)}</dd></div>
              )}
              {row.refundAmountCents > 0 && (
                <div><dt>Refunded</dt><dd className="tv-num tv-refunded">−{formatMoney(row.refundAmountCents, row.currency)}</dd></div>
              )}
              {row.providerPaymentId ? (
                <div>
                  <dt>Reference</dt>
                  <dd className="tv-mono">{row.providerPaymentId}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="tv-detail-group">
            <h3 className="tv-detail-heading">Related</h3>
            <dl className="tv-detail-list">
              <div>
                <dt>Appointment</dt>
                <dd>
                  <a href={appointmentHref(row.appointmentId)} className="tv-link">
                    View appointment
                  </a>
                </dd>
              </div>
              {row.contactId ? (
                <div>
                  <dt>Customer</dt>
                  <dd>
                    <a href={`/contacts/${row.contactId}`} className="tv-link">
                      View contact
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {row.status === "failed" && row.failureReason ? (
            <section className="tv-detail-group">
              <h3 className="tv-detail-heading">Failure</h3>
              <p className="tv-drawer-note">{row.failureReason}</p>
            </section>
          ) : null}

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
                    <p className="tv-tl-title">Payment received via {methodLabel}</p>
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
                    <p className="tv-tl-time">{row.failureReason || "The charge was declined."}</p>
                  </div>
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className="tv-drawer-foot">
          {canRefund ? (
            <button className="tv-btn tv-btn-danger-outline" onClick={() => onRefund(row)}>
              <RotateCcw size={14} /> {row.refundAmountCents > 0 ? "Refund remaining" : "Refund"}
            </button>
          ) : (
            <a href={appointmentHref(row.appointmentId)} className="tv-btn tv-btn-secondary">
              View appointment
            </a>
          )}
          {row.providerPaymentId ? (
            <a
              href={providerDashboardHref(row.provider, row.providerPaymentId)}
              target="_blank"
              rel="noreferrer"
              className="tv-btn tv-btn-ghost"
            >
              Open in {providerName} <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </aside>
    </>
  );
}
