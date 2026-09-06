"use client";

import { useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { formatPrice, type BookingType } from "../mock-data";

export default function PaymentStep({
  type,
  onCancel,
  onSuccess,
}: {
  type: BookingType;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const price = formatPrice(type.config?.payment) || "$0.00";
  const amount = price.replace(/^Deposit /, "").replace(/ USD$/, "");

  function pay() {
    setError("");
    if (card.replace(/\s/g, "").length < 15 || !exp || cvc.length < 3) {
      setError("Enter complete card details to continue.");
      return;
    }
    setPaying(true);
    // Sandbox: simulate /api/public/book/[slug]/payment round trip
    setTimeout(() => {
      setPaying(false);
      onSuccess();
    }, 1100);
  }

  return (
    <div>
      <h1 className="eb-title">Complete payment</h1>
      <p className="eb-sub">
        Pay {price} securely with Square. Card details are processed by Square — never
        stored by Transovo.
      </p>

      <div className="eb-form-grid">
        <div className="eb-field eb-field--full">
          <label className="eb-field-label" htmlFor="eb-card">Card number</label>
          <input
            id="eb-card"
            className="eb-input"
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            autoComplete="cc-number"
            value={card}
            onChange={(e) =>
              setCard(
                e.target.value.replace(/[^\d]/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim(),
              )
            }
          />
        </div>
      </div>
      <div className="eb-pay">
        <div className="eb-pay__row">
          <div className="eb-field">
            <label className="eb-field-label" htmlFor="eb-exp">Expiry</label>
            <input
              id="eb-exp"
              className="eb-input"
              inputMode="numeric"
              placeholder="MM / YY"
              autoComplete="cc-exp"
              value={exp}
              onChange={(e) => setExp(e.target.value.slice(0, 7))}
            />
          </div>
          <div className="eb-field">
            <label className="eb-field-label" htmlFor="eb-cvc">Security code</label>
            <input
              id="eb-cvc"
              className="eb-input"
              inputMode="numeric"
              placeholder="CVC"
              autoComplete="cc-csc"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
        </div>
        <div className="eb-pay__secure">
          <Lock size={12} aria-hidden /> Payments are encrypted end to end.
        </div>
      </div>

      {error ? (
        <div className="eb-alert" role="alert">
          <AlertCircle size={15} aria-hidden style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      ) : null}

      <div className="eb-actions">
        <button type="button" className="eb-btn eb-btn--outline" onClick={onCancel} disabled={paying}>
          Cancel
        </button>
        <button type="button" className="eb-btn eb-btn--primary" onClick={pay} disabled={paying}>
          {paying ? "Processing…" : `Pay ${amount}`}
        </button>
      </div>
    </div>
  );
}
