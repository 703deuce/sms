"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { getSettingsTabs } from "@/lib/settings-tabs";
import { appointmentsIntegrationsTabs } from "@/lib/products/appointments-settings-tabs";
import type { MerchantConnectionView } from "@/lib/merchant-payments/types";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function statusLabel(status: MerchantConnectionView["status"]) {
  switch (status) {
    case "connected":
      return "Connected";
    case "onboarding_incomplete":
      return "Onboarding incomplete";
    case "needs_attention":
      return "Needs attention";
    case "disabled":
      return "Disconnected";
    default:
      return "Not connected";
  }
}

function statusTone(status: MerchantConnectionView["status"]) {
  if (status === "connected") return "text-emerald-700 bg-emerald-50 ring-emerald-600/20";
  if (status === "needs_attention") return "text-amber-800 bg-amber-50 ring-amber-600/20";
  if (status === "onboarding_incomplete") return "text-sky-800 bg-sky-50 ring-sky-600/20";
  return "text-slate-600 bg-slate-100 ring-slate-500/20";
}

function ProviderCard({
  name,
  connection,
  onConnect,
  onReconnect,
  onDisconnect,
  onManageDashboard,
  connecting,
}: {
  name: string;
  connection: MerchantConnectionView;
  onConnect: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onManageDashboard?: () => void;
  connecting: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Customer appointment payments settle to your {name} account. Transovo does not hold funds.
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusTone(connection.status)}`}
            >
              {statusLabel(connection.status)}
            </span>
            {connection.canAcceptPayments ? (
              <p className="mt-2 text-[12px] text-emerald-700">Ready to accept appointment payments</p>
            ) : connection.lastError ? (
              <p className="mt-2 text-[12px] text-amber-700">{connection.lastError}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {connection.status === "not_connected" || connection.status === "disabled" ? (
            <Button size="sm" onClick={onConnect} disabled={connecting}>
              Connect {name}
            </Button>
          ) : (
            <>
              {connection.status !== "connected" ? (
                <Button size="sm" variant="outline" onClick={onReconnect} disabled={connecting}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {connection.status === "needs_attention" ? "Update account" : "Continue setup"}
                </Button>
              ) : onManageDashboard ? (
                <Button size="sm" variant="outline" onClick={onManageDashboard} disabled={connecting}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Manage in Stripe
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={onDisconnect} disabled={connecting}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function MerchantPaymentsSettingsPanel({
  variant = "settings",
}: {
  variant?: "settings" | "integrations";
}) {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<MerchantConnectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/merchant-payments/status");
    const json = await res.json();
    setConnections(json.data?.connections || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("stripe") === "return") {
      load();
    }
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

  async function disconnect(provider: "stripe" | "square") {
    setActing(provider);
    await fetch(`/api/merchant-payments/${provider}/disconnect`, { method: "POST" });
    setActing(null);
    await load();
  }

  const stripe = connections.find((c) => c.provider === "STRIPE");
  const square = connections.find((c) => c.provider === "SQUARE");

  const tabItems = variant === "integrations" ? appointmentsIntegrationsTabs : getSettingsTabs();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Tabs items={tabItems} />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {variant === "integrations" ? "Payment integrations" : "Payments"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect Stripe or Square so customers can pay deposits or full appointment amounts during booking.
          These are merchant payments to your business — separate from Transovo subscription billing.
        </p>
      </div>

      <Card className="border-dashed p-4 text-[13px] text-muted-foreground">
        <p className="font-medium text-foreground">How it works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>You connect your own Stripe or Square merchant account</li>
          <li>Customers pay during the Transovo booking flow</li>
          <li>Funds go directly to your processor account</li>
          <li>Transovo tracks payment status on each appointment</li>
        </ul>
        <a
          href="https://stripe.com/connect"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-primary text-[12px] font-semibold hover:underline"
        >
          Learn about Stripe Connect <ExternalLink className="h-3 w-3" />
        </a>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading payment providers…</p>
      ) : (
        <div className="space-y-4">
          {stripe ? (
            <ProviderCard
              name="Stripe"
              connection={stripe}
              onConnect={connectStripe}
              onReconnect={connectStripe}
              onDisconnect={() => disconnect("stripe")}
              onManageDashboard={openStripeDashboard}
              connecting={acting === "stripe" || acting === "stripe-dashboard"}
            />
          ) : null}
          {square ? (
            <ProviderCard
              name="Square"
              connection={square}
              onConnect={connectSquare}
              onReconnect={connectSquare}
              onDisconnect={() => disconnect("square")}
              connecting={acting === "square"}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
