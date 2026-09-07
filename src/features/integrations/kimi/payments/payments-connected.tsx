"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import "@/components/integrations/kimi-ui/payments/reference.css";
import { MerchantPaymentsPanel } from "@/components/integrations/kimi-ui/payments/components/MerchantPaymentsPanel";
import type {
  MerchantConnectionView,
  MerchantPaymentProvider,
} from "@/components/integrations/kimi-ui/payments/types";

export function PaymentsIntegrationsConnected() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<MerchantConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<MerchantPaymentProvider | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant-payments/status");
      const json = await res.json();
      setConnections(json.data?.connections || []);
    } catch {
      setError("Payment connection status couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("stripe") === "return") load();
  }, [load, searchParams]);

  async function connectStripe() {
    setActing("stripe");
    const res = await fetch("/api/merchant-payments/stripe/connect", { method: "POST" });
    const json = await res.json();
    setActing(null);
    if (json.data?.url) window.location.href = json.data.url;
  }

  async function connectSquare() {
    setActing("square");
    const res = await fetch("/api/merchant-payments/square/connect");
    const json = await res.json();
    setActing(null);
    if (json.data?.url) window.location.href = json.data.url;
  }

  async function openStripeDashboard() {
    setActing("stripe-dashboard");
    const res = await fetch("/api/merchant-payments/stripe/dashboard", { method: "POST" });
    const json = await res.json();
    setActing(null);
    if (json.data?.url) window.location.href = json.data.url;
  }

  async function disconnect(provider: MerchantPaymentProvider) {
    const slug = provider === "STRIPE" ? "stripe" : "square";
    setActing(slug);
    await fetch(`/api/merchant-payments/${slug}/disconnect`, { method: "POST" });
    setActing(null);
    setPendingDisconnect(null);
    await load();
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
        onConnectStripe={connectStripe}
        onConnectSquare={connectSquare}
        onReconnect={(p) => (p === "STRIPE" ? connectStripe() : connectSquare())}
        onManageStripeDashboard={openStripeDashboard}
        onDisconnect={setPendingDisconnect}
        onCancelDisconnect={() => setPendingDisconnect(null)}
        onConfirmDisconnect={() => pendingDisconnect && disconnect(pendingDisconnect)}
        onSimulateEmpty={() => {}}
        onSimulateError={() => setError("Payment connection status couldn't be loaded.")}
      />
    </div>
  );
}
