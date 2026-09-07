"use client";

import type { MerchantConnectionView, MerchantPaymentProvider } from "../types";
import { StatusChip } from "./StatusChip";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";

export function ProviderCard({
  name,
  connection,
  connecting,
  onConnect,
  onReconnect,
  onDisconnect,
  onManageDashboard,
}: {
  name: string;
  provider: MerchantPaymentProvider;
  connection: MerchantConnectionView;
  connecting: boolean;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onManageDashboard?: () => void;
}) {
  const connected = connection.status === "connected";
  const unconnected = connection.status === "not_connected" || connection.status === "disabled";

  return (
    <section className="tv-card tv-provider-card" aria-label={name}>
      <div className="tv-provider-main">
        <span className="tv-provider-icon" aria-hidden="true">
          <CreditCard className="h-5 w-5" />
        </span>
        <div className="tv-provider-body">
          <div className="tv-provider-heading">
            <h3 className="tv-card-title">{name}</h3>
            <StatusChip status={connection.status} />
          </div>
          <p className="tv-provider-desc">
            Customer appointment payments settle to your {name} account. Transovo does not hold funds.
          </p>
          {connection.connectedAt && connected ? (
            <p className="tv-provider-meta">
              Connected{" "}
              {new Date(connection.connectedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {connection.merchantAccountId ? ` · Account ${connection.merchantAccountId}` : ""}
            </p>
          ) : null}
          {connection.canAcceptPayments ? (
            <p className="tv-provider-ready">Ready to accept appointment payments</p>
          ) : connection.lastError ? (
            <p className="tv-provider-error">{connection.lastError}</p>
          ) : null}
        </div>
      </div>
      <div className="tv-provider-actions">
        {unconnected ? (
          <button className="tv-btn tv-btn--primary tv-btn--sm" onClick={onConnect} disabled={connecting}>
            {connecting ? "Connecting…" : `Connect ${name}`}
          </button>
        ) : (
          <>
            {!connected ? (
              <button className="tv-btn tv-btn--outline tv-btn--sm" onClick={onReconnect} disabled={connecting}>
                <RefreshCw className="h-3.5 w-3.5" />
                {connection.status === "needs_attention" ? "Update account" : "Continue setup"}
              </button>
            ) : onManageDashboard ? (
              <button className="tv-btn tv-btn--outline tv-btn--sm" onClick={onManageDashboard} disabled={connecting}>
                <ExternalLink className="h-3.5 w-3.5" />
                Manage in {name}
              </button>
            ) : null}
            <button className="tv-btn tv-btn--ghost tv-btn--sm" onClick={onDisconnect} disabled={connecting}>
              Disconnect
            </button>
          </>
        )}
      </div>
    </section>
  );
}
