"use client";

import { useState } from "react";
import type { MerchantConnectionView } from "../mock-data";
import { Lock, CreditCard } from "lucide-react";

/**
 * Preview of the customer-facing payment step during public booking.
 * Covers atomic features:
 *  - public-stripe-checkout (Stripe checkout redirect)
 *  - public-square-payment (Square payment UI)
 */
export function PaymentExperiencePreview({
  connections,
}: {
  connections: MerchantConnectionView[];
}) {
  const stripeConnected = connections.some((c) => c.provider === "STRIPE" && c.canAcceptPayments);
  const squareConnected = connections.some((c) => c.provider === "SQUARE" && c.canAcceptPayments);
  const [provider, setProvider] = useState<"STRIPE" | "SQUARE">(
    stripeConnected ? "STRIPE" : "SQUARE",
  );

  const active = provider === "STRIPE" ? stripeConnected : squareConnected;
  if (!active) return null;

  return (
    <section className="tv-preview" aria-label="Customer payment experience preview">
      <div className="tv-preview-header">
        <div>
          <h2 className="tv-section-title">Customer payment experience</h2>
          <p className="tv-section-desc">
            This is the payment step customers see on your booking page when a booking type
            requires a deposit or full payment.
          </p>
        </div>
        {stripeConnected && squareConnected ? (
          <div className="tv-segmented" role="group" aria-label="Preview provider">
            <button
              className={`tv-segmented-btn ${provider === "STRIPE" ? "tv-segmented-btn--active" : ""}`}
              onClick={() => setProvider("STRIPE")}
            >
              Stripe
            </button>
            <button
              className={`tv-segmented-btn ${provider === "SQUARE" ? "tv-segmented-btn--active" : ""}`}
              onClick={() => setProvider("SQUARE")}
            >
              Square
            </button>
          </div>
        ) : null}
      </div>

      <div className="tv-booking-preview" aria-hidden="true">
        <div className="tv-booking-summary">
          <p className="tv-booking-business">Riverside Dental</p>
          <p className="tv-booking-type">Initial consultation</p>
          <p className="tv-booking-when">Thursday, September 10 · 2:00 PM</p>
        </div>
        <div className="tv-booking-payment">
          <p className="tv-booking-payment-title">
            Deposit due today <span className="tv-booking-amount">$50.00</span>
          </p>
          <div className="tv-booking-field">
            <CreditCard className="h-4 w-4" />
            <span>Card number ·· ·· ··</span>
          </div>
          <div className="tv-booking-field-row">
            <div className="tv-booking-field tv-booking-field--half">MM / YY</div>
            <div className="tv-booking-field tv-booking-field--half">CVC</div>
          </div>
          <div className="tv-booking-pay-btn">
            {provider === "STRIPE" ? "Pay $50.00 with Stripe" : "Pay $50.00 with Square"}
          </div>
          <p className="tv-booking-secure">
            <Lock className="h-3 w-3" />
            {provider === "STRIPE"
              ? "Securely processed by Stripe. You will be redirected to complete payment."
              : "Securely processed by Square. Your card never touches Transovo servers."}
          </p>
        </div>
      </div>
      <p className="tv-preview-note">
        Preview only — the live booking page uses your connected {provider === "STRIPE" ? "Stripe" : "Square"} account.
      </p>
    </section>
  );
}
