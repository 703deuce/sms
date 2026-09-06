"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Lock } from "lucide-react";
import { Billing, formatCurrency } from "../mock-data";

const QUICK = [25, 50, 100, 250];

export function CreditPurchaseCard({
  billing,
  readOnly,
  onMessage,
}: {
  billing: Billing;
  readOnly: boolean;
  onMessage: (text: string, kind: "success" | "error") => void;
}) {
  const [amount, setAmount] = useState(50);
  const [purchasing, setPurchasing] = useState(false);

  async function purchaseCredits() {
    setPurchasing(true);
    try {
      // Sandbox: POST /api/settings/billing { amountCents: amount * 100 }
      await new Promise((r) => setTimeout(r, 900));
      onMessage(`Added ${formatCurrency(amount)} in credits.`, "success");
    } catch {
      onMessage("Purchase failed", "error");
    } finally {
      setPurchasing(false);
    }
  }

  async function openStripePortal() {
    // Sandbox: POST /api/settings/billing { action: "stripe_portal" } → json.url
    onMessage("Stripe portal not configured in preview.", "error");
  }

  return (
    <div className="tv-card">
      <div className="tv-card-head">
        <div>
          <h3 className="tv-card-title">Credits & payment</h3>
          <p className="tv-card-desc">
            Credits cover reminder SMS usage. Balance is applied before card charges.
          </p>
        </div>
      </div>
      <div className="tv-card-body">
        <div className="tv-meta-row">
          <span className="tv-meta-key">Payment management</span>
          <span className="tv-meta-val">
            {billing.stripeConfigured ? (
              <span className="tv-chip tv-chip-success">
                <Lock /> Stripe connected
              </span>
            ) : (
              <span className="tv-chip tv-chip-neutral">Workspace billing</span>
            )}
          </span>
        </div>
        <div className="tv-meta-row">
          <span className="tv-meta-key">Credit tracking</span>
          <span className="tv-meta-val">
            {billing.creditTrackingEnabled ? (
              <span className="tv-chip tv-chip-info">Enabled</span>
            ) : (
              <span className="tv-chip tv-chip-neutral">Disabled</span>
            )}
          </span>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="tv-label" htmlFor="credit-amount">Credit amount (USD)</label>
          <div className="tv-input-group">
            <div className="tv-input-prefix">
              <span>$</span>
              <input
                id="credit-amount"
                className="tv-input"
                type="number"
                min={5}
                step={5}
                value={amount}
                disabled={readOnly}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <button
              className="tv-btn tv-btn-primary"
              onClick={purchaseCredits}
              disabled={purchasing || readOnly || amount < 5}
            >
              <CreditCard />
              {purchasing ? "Processing…" : "Add credits"}
            </button>
          </div>
          <div className="tv-quick-amounts">
            {QUICK.map((q) => (
              <button
                key={q}
                className={amount === q ? "tv-chip-btn selected" : "tv-chip-btn"}
                onClick={() => setAmount(q)}
                disabled={readOnly}
              >
                ${q}
              </button>
            ))}
          </div>
        </div>

        {billing.stripeConfigured && (
          <div style={{ marginTop: 16 }}>
            <button className="tv-link" onClick={openStripePortal} disabled={readOnly}>
              Manage payment method & billing details in Stripe <ExternalLink />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
