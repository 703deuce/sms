"use client";

import { useCallback, useEffect, useState } from "react";
import { MerchantPaymentsPanel } from "./components/MerchantPaymentsPanel";
import {
  MOCK_CONNECTIONS,
  NOT_CONNECTED_CONNECTIONS,
  type MerchantConnectionView,
  type MerchantPaymentProvider,
} from "./mock-data";
import "./reference.css";

/**
 * Transovo — Integrations → Payments (/integrations/payments)
 * Sandbox reconstruction. Cursor wires the handlers to:
 *   GET  /api/merchant-payments/status
 *   POST /api/merchant-payments/stripe/connect
 *   POST /api/merchant-payments/square/connect
 *   POST /api/merchant-payments/stripe/dashboard
 *   POST /api/merchant-payments/${provider}/disconnect
 */
export default function IntegrationsPaymentsPage() {
  const [connections, setConnections] = useState<MerchantConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<MerchantPaymentProvider | null>(null);

  // Simulates /api/merchant-payments/status
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 500));
    setConnections(MOCK_CONNECTIONS);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  function patchProvider(provider: MerchantPaymentProvider, status: MerchantConnectionView["status"]) {
    setConnections((prev) =>
      prev.map((c) =>
        c.provider === provider
          ? {
              ...c,
              status,
              chargesEnabled: status === "connected",
              payoutsEnabled: status === "connected",
              onboardingComplete: status === "connected",
              canAcceptPayments: status === "connected",
              lastError: null,
              connectedAt: status === "connected" ? new Date().toISOString() : c.connectedAt,
            }
          : c,
      ),
    );
  }

  async function simulate(key: string, done: () => void, message?: string) {
    setActing(key);
    await new Promise((r) => setTimeout(r, 700));
    setActing(null);
    done();
    if (message) setToast(message);
  }

  function confirmDisconnect() {
    const provider = pendingDisconnect;
    if (!provider) return;
    setPendingDisconnect(null);
    simulate(
      provider.toLowerCase(),
      () => patchProvider(provider, "disabled"),
      `${provider === "STRIPE" ? "Stripe" : "Square"} disconnected. New bookings will no longer offer payment.`,
    );
  }

  return (
    <div className="tv-page">
      <MerchantPaymentsPanel
        connections={connections}
        loading={loading}
        acting={acting}
        error={error}
        pendingDisconnect={pendingDisconnect}
        onRetry={load}
        onConnectStripe={() =>
          simulate("stripe", () => patchProvider("STRIPE", "onboarding_incomplete"), "Redirecting to Stripe onboarding…")
        }
        onConnectSquare={() =>
          simulate("square", () => patchProvider("SQUARE", "onboarding_incomplete"), "Redirecting to Square authorization…")
        }
        onReconnect={(p) =>
          simulate(p.toLowerCase(), () => patchProvider(p, "connected"), `${p === "STRIPE" ? "Stripe" : "Square"} account updated.`)
        }
        onManageStripeDashboard={() => simulate("stripe-dashboard", () => {}, "Opening Stripe dashboard…")}
        onDisconnect={(p) => setPendingDisconnect(p)}
        onCancelDisconnect={() => setPendingDisconnect(null)}
        onConfirmDisconnect={confirmDisconnect}
        onSimulateEmpty={() => setConnections(NOT_CONNECTED_CONNECTIONS)}
        onSimulateError={() => setError("Payment connection status couldn't be loaded.")}
      />
      {toast ? (
        <div className="tv-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
