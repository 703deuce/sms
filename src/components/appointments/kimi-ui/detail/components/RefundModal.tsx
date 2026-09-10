"use client";

import { useState } from "react";
import { Button } from "./ui";

type Props = {
  open: boolean;
  amountPaidCents: number;
  amountRefundedCents: number;
  supportsAccountCredit: boolean;
  onClose: () => void;
  onConfirm: (input: {
    amountCents: number;
    refundToAccountCredit: boolean;
    reason: string;
  }) => Promise<void>;
};

export function RefundModal({
  open,
  amountPaidCents,
  amountRefundedCents,
  supportsAccountCredit,
  onClose,
  onConfirm,
}: Props) {
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState<"original" | "credit">("original");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const maxRefundable = Math.max(0, amountPaidCents - amountRefundedCents);
  const amountCents = Math.round(parseFloat(amount || "0") * 100);

  async function submit() {
    setError("");
    if (!amountCents || amountCents <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    if (amountCents > maxRefundable) {
      setError("Refund amount exceeds the maximum refundable.");
      return;
    }
    setLoading(true);
    try {
      await onConfirm({
        amountCents,
        refundToAccountCredit: destination === "credit",
        reason,
      });
      onClose();
    } catch {
      setError("Refund could not be processed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-labelledby="refund-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="refund-title">Refund</h2>
        <div className="info-list" style={{ marginBottom: 12 }}>
          <div className="info-row">
            <span className="info-label">Amount paid</span>
            <span className="info-value">${(amountPaidCents / 100).toFixed(2)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Already refunded</span>
            <span className="info-value">${(amountRefundedCents / 100).toFixed(2)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Maximum refundable</span>
            <span className="info-value">${(maxRefundable / 100).toFixed(2)}</span>
          </div>
        </div>
        <label className="label" htmlFor="refund-amount">Refund amount</label>
        <input
          id="refund-amount"
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <fieldset style={{ margin: "12px 0", border: "none", padding: 0 }}>
          <legend className="label">Refund destination</legend>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="radio"
              name="refund-dest"
              checked={destination === "original"}
              onChange={() => setDestination("original")}
            />
            Original payment method
          </label>
          {supportsAccountCredit ? (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="radio"
                name="refund-dest"
                checked={destination === "credit"}
                onChange={() => setDestination("credit")}
              />
              Add to customer account credit
            </label>
          ) : null}
        </fieldset>
        <label className="label" htmlFor="refund-reason">Reason</label>
        <input
          id="refund-reason"
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error ? <p className="muted small" style={{ color: "var(--red)" }}>{error}</p> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={loading}>{loading ? "Processing…" : "Confirm refund"}</Button>
        </div>
      </div>
    </div>
  );
}
