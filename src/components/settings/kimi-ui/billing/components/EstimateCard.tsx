"use client";

import { Info } from "lucide-react";
import { Estimate, formatCurrency } from "../types";

function cents(n: number) {
  return formatCurrency(n / 100);
}

export function EstimateCard({ estimate }: { estimate: Estimate }) {
  return (
    <div className="tv-card">
      <div className="tv-card-head">
        <div>
          <h3 className="tv-card-title">Upcoming estimate</h3>
          <p className="tv-card-desc">{estimate.periodLabel} · billed in {estimate.currency.toUpperCase()}</p>
        </div>
        <span className="tv-chip tv-chip-neutral">Estimated</span>
      </div>
      <div className="tv-card-body">
        <div className="tv-lineitems">
          {estimate.lineItems.map((li) => (
            <div key={li.id} className="tv-lineitem">
              <div>
                <div className="tv-lineitem-label">{li.label}</div>
                {li.detail && <div className="tv-lineitem-detail">{li.detail}</div>}
              </div>
              <span className="tv-lineitem-amount">{cents(li.amountCents)}</span>
            </div>
          ))}
        </div>
        <div className="tv-subtotal-row">
          <span>Subtotal</span>
          <span>{cents(estimate.subtotalCents)}</span>
        </div>
        <div className="tv-subtotal-row" style={{ borderTop: "none", marginTop: 0, paddingTop: 4 }}>
          <span>Estimated tax</span>
          <span>{cents(estimate.estimatedTaxCents)}</span>
        </div>
        <div className="tv-total-row">
          <span>Estimated total</span>
          <span>{cents(estimate.totalCents)}</span>
        </div>
        {estimate.notes.map((n, i) => (
          <div key={i} className="tv-note tv-note-info">
            <Info />
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
