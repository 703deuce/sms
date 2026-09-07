"use client";

import { CreditCard, MessageSquare, Sparkles, Wallet } from "lucide-react";
import { Billing, Metrics, formatCurrency, formatNumber, titleCasePlan } from "../types";

export function BillingStatCards({
  metrics,
  billing,
  personalMode = false,
  forwardingMinutesUsed,
}: {
  metrics: Metrics;
  billing: Billing;
  personalMode?: boolean;
  forwardingMinutesUsed?: number | null;
}) {
  return (
    <div className="tv-stats">
      <div className="tv-stat">
        <div className="tv-stat-label">
          <Sparkles size={12} /> Current plan
        </div>
        <div className="tv-stat-value">{titleCasePlan(billing.plan)}</div>
        <div className="tv-stat-hint">
          {billing.stripeConfigured ? "Managed in Stripe" : "Workspace billing"}
        </div>
      </div>
      <div className="tv-stat">
        <div className="tv-stat-label">
          <Wallet size={12} /> Credit balance
        </div>
        <div className="tv-stat-value">{formatCurrency(billing.balance)}</div>
        <div className="tv-stat-hint">Applied automatically to usage</div>
      </div>
      <div className="tv-stat">
        <div className="tv-stat-label">
          <CreditCard size={12} /> Credits remaining
        </div>
        <div className="tv-stat-value">{formatNumber(metrics.creditsRemaining)}</div>
        <div className="tv-stat-hint">Message credits this cycle</div>
      </div>
      <div className="tv-stat">
        <div className="tv-stat-label">
          <MessageSquare size={12} /> Messages sent
        </div>
        <div className="tv-stat-value">
          {personalMode && forwardingMinutesUsed !== null && forwardingMinutesUsed !== undefined
            ? `${forwardingMinutesUsed} min`
            : formatNumber(metrics.messagesSentPeriod)}
        </div>
        <div className="tv-stat-hint">
          {personalMode ? "Forwarding minutes" : "Current billing period"}
        </div>
      </div>
    </div>
  );
}
