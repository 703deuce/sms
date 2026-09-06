"use client";

import type { MerchantConnectionView, MerchantPaymentProvider } from "../mock-data";
import { integrationsTabs } from "../mock-data";
import { Tabs } from "./Tabs";
import { ProviderCard } from "./ProviderCard";
import { DisconnectModal } from "./DisconnectModal";
import { PaymentExperiencePreview } from "./PaymentExperiencePreview";
import { AlertTriangle, CreditCard } from "lucide-react";

export function MerchantPaymentsPanel({
  connections,
  loading,
  acting,
  error,
  pendingDisconnect,
  onRetry,
  onConnectStripe,
  onConnectSquare,
  onReconnect,
  onManageStripeDashboard,
  onDisconnect,
  onCancelDisconnect,
  onConfirmDisconnect,
  onSimulateEmpty,
  onSimulateError,
}: {
  connections: MerchantConnectionView[];
  loading: boolean;
  acting: string | null;
  error: string | null;
  pendingDisconnect: MerchantPaymentProvider | null;
  onRetry: () => void;
  onConnectStripe: () => void;
  onConnectSquare: () => void;
  onReconnect: (p: MerchantPaymentProvider) => void;
  onManageStripeDashboard: () => void;
  onDisconnect: (p: MerchantPaymentProvider) => void;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onSimulateEmpty: () => void;
  onSimulateError: () => void;
}) {
  const stripe = connections.find((c) => c.provider === "STRIPE");
  const square = connections.find((c) => c.provider === "SQUARE");
  const anyConnected = connections.some((c) => c.status === "connected" && c.canAcceptPayments);

  return (
    <div className="tv-container">
      {/* Page header */}
      <header className="tv-page-header">
        <div>
          <h1 className="tv-page-title">Integrations</h1>
          <p className="tv-page-subtitle">Connect external systems Transovo works with.</p>
        </div>
      </header>

      <Tabs items={integrationsTabs} active="/integrations/payments" />

      <div className="tv-section-heading">
        <h2 className="tv-section-title">Appointment payments</h2>
        <p className="tv-section-desc">
          Connect a payment provider to collect deposits or full payments when customers book.
          Providers settle directly to your account.
        </p>
      </div>

      {error ? (
        <div className="tv-alert tv-alert--error" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <div>
            <p className="tv-alert-title">{error}</p>
            <p className="tv-alert-body">Connection states may be out of date. Try again.</p>
          </div>
          <button className="tv-btn tv-btn--outline tv-btn--sm" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="tv-stack" aria-busy="true" aria-label="Loading payment providers">
          {[0, 1].map((i) => (
            <div key={i} className="tv-card tv-skeleton-card">
              <div className="tv-skeleton tv-skeleton-icon" />
              <div className="tv-skeleton-lines">
                <div className="tv-skeleton tv-skeleton-line tv-skeleton-line--title" />
                <div className="tv-skeleton tv-skeleton-line" />
                <div className="tv-skeleton tv-skeleton-line tv-skeleton-line--short" />
              </div>
            </div>
          ))}
        </div>
      ) : !stripe && !square ? (
        <div className="tv-card tv-empty">
          <CreditCard className="h-6 w-6 tv-empty-icon" aria-hidden="true" />
          <h3 className="tv-card-title">No payment providers yet</h3>
          <p className="tv-provider-desc">
            Connect Stripe or Square to accept payments when customers book appointments.
          </p>
        </div>
      ) : (
        <div className="tv-stack">
          {stripe ? (
            <ProviderCard
              name="Stripe"
              provider="STRIPE"
              connection={stripe}
              connecting={acting === "stripe" || acting === "stripe-dashboard"}
              onConnect={onConnectStripe}
              onReconnect={() => onReconnect("STRIPE")}
              onManageDashboard={onManageStripeDashboard}
              onDisconnect={() => onDisconnect("STRIPE")}
            />
          ) : null}
          {square ? (
            <ProviderCard
              name="Square"
              provider="SQUARE"
              connection={square}
              connecting={acting === "square"}
              onConnect={onConnectSquare}
              onReconnect={() => onReconnect("SQUARE")}
              onDisconnect={() => onDisconnect("SQUARE")}
            />
          ) : null}
        </div>
      )}

      {!loading && anyConnected ? <PaymentExperiencePreview connections={connections} /> : null}

      <p className="tv-footnote">
        Payment processing is handled by your provider. Fees, payouts, and disputes are managed in
        your Stripe or Square account. Sandbox states:{" "}
        <button className="tv-link" onClick={onSimulateEmpty}>first use</button> ·{" "}
        <button className="tv-link" onClick={onSimulateError}>error</button>
      </p>

      {pendingDisconnect ? (
        <DisconnectModal
          provider={pendingDisconnect}
          disconnecting={acting === pendingDisconnect.toLowerCase()}
          onCancel={onCancelDisconnect}
          onConfirm={onConfirmDisconnect}
        />
      ) : null}
    </div>
  );
}
