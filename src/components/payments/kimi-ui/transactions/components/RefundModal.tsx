"use client";

import { useEffect, useRef, useState } from "react";
import { X, RotateCcw, Check } from "lucide-react";
import { TransactionRow, formatMoney } from "../types";

type RefundPhase = "confirm" | "processing" | "done";
type RefundDestination = "original_method" | "account_credit";

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
  const [destination, setDestination] = useState<RefundDestination>("original_method");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const refundableCents = row ? row.amountPaidCents - row.refundAmountCents : 0;
  const canUseAccountCredit = Boolean(row?.contactId);

  useEffect(() => {
    if (row) {
      setPhase("confirm");
      setAmountStr(((row.amountPaidCents - row.refundAmountCents) / 100).toFixed(2));
      setDestination("original_method");
      setReason("");
      setError(null);
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
    if (destination === "account_credit" && !row.contactId) {
      setError("Account credit refunds require a linked customer.");
      return;
    }
    setError(null);
    setPhase("processing");
    fetch("/api/merchant-payments/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: row.appointmentId,
        amountCents: cents,
        reason: reason.trim() || undefined,
        refundToWallet: destination === "account_credit",
        contactId: destination === "account_credit" ? row.contactId : undefined,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("refund failed");
        onRefunded(row.id, cents);
        setPhase("done");
      })
      .catch(() => {
        setError("Refund could not be completed. Try again.");
        setPhase("confirm");
      });
  };

  const providerName = row.provider === "stripe" ? "Stripe" : "Square";
  const methodLabel = row.paymentMethodLabel || providerName;

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
              <strong>{row.customerName}</strong>
              {destination === "account_credit"
                ? " as customer account credit."
                : ` through ${methodLabel}.`}
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
              Refund {row.customerName} for <strong>{row.appointmentTitle}</strong>.
            </p>

            <dl className="tv-refund-summary">
              <div>
                <dt>Original payment</dt>
                <dd>{formatMoney(row.amountPaidCents, row.currency)}</dd>
              </div>
              {row.refundAmountCents > 0 && (
                <div>
                  <dt>Already refunded</dt>
                  <dd>{formatMoney(row.refundAmountCents, row.currency)}</dd>
                </div>
              )}
              <div>
                <dt>Maximum refundable</dt>
                <dd>{formatMoney(refundableCents, row.currency)}</dd>
              </div>
            </dl>

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
                Up to {formatMoney(refundableCents, row.currency)} available to refund.
              </p>
            </div>

            <fieldset className="tv-field">
              <legend className="tv-label">Destination</legend>
              <label className="tv-radio">
                <input
                  type="radio"
                  name="refund-destination"
                  checked={destination === "original_method"}
                  onChange={() => setDestination("original_method")}
                  disabled={phase === "processing"}
                />
                <span>
                  Original payment method
                  <span className="tv-hint block">{methodLabel}</span>
                </span>
              </label>
              {canUseAccountCredit ? (
                <label className="tv-radio">
                  <input
                    type="radio"
                    name="refund-destination"
                    checked={destination === "account_credit"}
                    onChange={() => setDestination("account_credit")}
                    disabled={phase === "processing"}
                  />
                  <span>
                    Customer account credit
                    <span className="tv-hint block">
                      Adds the refund to the customer&apos;s Transovo account credit instead of
                      returning it to the card.
                    </span>
                  </span>
                </label>
              ) : null}
            </fieldset>

            <div className="tv-field">
              <label className="tv-label" htmlFor="tv-refund-reason">
                Reason <span className="tv-optional">(optional)</span>
              </label>
              <input
                id="tv-refund-reason"
                className="tv-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={phase === "processing"}
                placeholder="Customer request, duplicate charge…"
              />
            </div>

            {error && (
              <p className="tv-error-text" id="tv-refund-error" role="alert">
                {error}
              </p>
            )}

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
