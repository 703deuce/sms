"use client";

import { useEffect, useRef, useState } from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { TransactionRow, formatMoney } from "../mock-data";

type RefundPhase = "confirm" | "processing" | "done";

export function RefundModal({
  row,
  onClose,
  onRefunded,
}: {
  row: TransactionRow | null;
  onClose: () => void;
  onRefunded: (id: string, refundAmountCents: number) => void;
}) {
  const [phase, setPhase] = useState<RefundPhase>("confirm");
  const [amountStr, setAmountStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const refundableCents = row ? row.amountPaidCents - row.refundAmountCents : 0;

  useEffect(() => {
    if (row) {
      setPhase("confirm");
      setAmountStr(((row.amountPaidCents - row.refundAmountCents) / 100).toFixed(2));
      setError(null);
      // Initial focus on the safe action (Cancel) for a destructive dialog
      setTimeout(() => closeRef.current?.focus(), 0);
    }
  }, [row]);

  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "processing") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, phase, onClose]);

  if (!row) return null;

  const submit = () => {
    const cents = Math.round(parseFloat(amountStr) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter a refund amount greater than $0.00.");
      return;
    }
    if (cents > refundableCents) {
      setError(
        `Refund can’t exceed the remaining paid amount of ${formatMoney(refundableCents, row.currency)}.`,
      );
      return;
    }
    setError(null);
    setPhase("processing");
    // Simulated provider refund call
    setTimeout(() => {
      onRefunded(row.id, cents);
      setPhase("done");
    }, 900);
  };

  return (
    <>
      <div
        className="tv-scrim"
        onClick={() => phase !== "processing" && onClose()}
        aria-hidden="true"
      />
      <div
        className="tv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tv-refund-title"
      >
        <div className="tv-modal-head">
          <h2 className="tv-modal-title" id="tv-refund-title">
            {phase === "done" ? "Refund issued" : "Refund payment"}
          </h2>
          <button
            ref={closeRef}
            className="tv-icon-btn"
            onClick={onClose}
            disabled={phase === "processing"}
            aria-label="Close refund dialog"
          >
            <X size={18} />
          </button>
        </div>

        {phase === "done" ? (
          <div className="tv-modal-body tv-modal-done">
            <div className="tv-state-icon tv-state-icon-brand" aria-hidden="true">
              <Check size={20} />
            </div>
            <p className="tv-modal-text">
              {formatMoney(Math.round(parseFloat(amountStr) * 100), row.currency)} was refunded to{" "}
              <strong>{row.customerName}</strong> through{" "}
              {row.provider === "stripe" ? "Stripe" : "Square"}. The transaction now shows the
              refunded amount.
            </p>
            <div className="tv-modal-actions">
              <button className="tv-btn tv-btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="tv-modal-body">
            <p className="tv-modal-text">
              Refund {row.customerName} for <strong>{row.appointmentTitle}</strong>. The refund is
              sent back to the original payment method through{" "}
              {row.provider === "stripe" ? "Stripe" : "Square"} and can’t be undone.
            </p>

            <div className="tv-field">
              <label className="tv-label" htmlFor="tv-refund-amount">
                Refund amount ({row.currency.toUpperCase()})
              </label>
              <div className="tv-money-input">
                <span className="tv-money-prefix">$</span>
                <input
                  id="tv-refund-amount"
                  className="tv-input"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  disabled={phase === "processing"}
                  aria-describedby="tv-refund-hint tv-refund-error"
                />
              </div>
              <p className="tv-hint" id="tv-refund-hint">
                Up to {formatMoney(refundableCents, row.currency)} available to refund
                {row.refundAmountCents > 0
                  ? ` (${formatMoney(row.refundAmountCents, row.currency)} already refunded)`
                  : ""}
                .
              </p>
              {error && (
                <p className="tv-error-text" id="tv-refund-error" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="tv-modal-actions">
              <button
                className="tv-btn tv-btn-secondary"
                onClick={onClose}
                disabled={phase === "processing"}
              >
                Cancel
              </button>
              <button
                className="tv-btn tv-btn-danger"
                onClick={submit}
                disabled={phase === "processing"}
              >
                {phase === "processing" ? (
                  <>Processing…</>
                ) : (
                  <>
                    <RotateCcw size={14} /> Issue refund
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
