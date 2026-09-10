"use client";

import { useEffect, useRef, useState } from "react";

type StripeCard = {
  mount: (el: HTMLElement) => void;
  unmount: () => void;
};

type StripeElements = {
  create: (type: "card", options?: Record<string, unknown>) => StripeCard;
};

type StripeInstance = {
  elements: () => StripeElements;
  confirmCardSetup: (
    clientSecret: string,
    data: { payment_method: { card: StripeCard } },
  ) => Promise<{ error?: { message?: string }; setupIntent?: { payment_method?: string | { id?: string } } }>;
};

declare global {
  interface Window {
    Stripe?: (key: string, options?: { stripeAccount?: string }) => StripeInstance;
  }
}

type PaymentMethodInfo = {
  hasSavedCard: boolean;
  card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number } | null;
  stripePublishableKey?: string | null;
  stripeAccount?: string | null;
  providerConfigured?: boolean;
};

export function PortalPaymentMethodSection({
  portalToken,
  paymentMethod,
  onUpdated,
}: {
  portalToken: string;
  paymentMethod: PaymentMethodInfo | null;
  onUpdated: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [makeDefault, setMakeDefault] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const stripeCardRef = useRef<StripeCard | null>(null);
  const stripeRef = useRef<StripeInstance | null>(null);

  useEffect(() => {
    if (!showAdd) return;
    const publishableKey = paymentMethod?.stripePublishableKey;
    const stripeAccount = paymentMethod?.stripeAccount;
    if (!publishableKey || !stripeAccount || !cardRef.current) {
      setError("Secure payment form is not available right now.");
      return;
    }

    let cancelled = false;
    setFormLoading(true);
    setError(null);

    const init = async () => {
      const scriptId = "stripe-js-v3";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://js.stripe.com/v3/";
        script.async = true;
        document.body.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Could not load payment provider"));
        });
      }

      if (cancelled || !window.Stripe || !cardRef.current) return;

      const stripe = window.Stripe(publishableKey, { stripeAccount });
      stripeRef.current = stripe;
      const elements = stripe.elements();
      const card = elements.create("card", {
        style: {
          base: {
            fontSize: "16px",
            color: "#1a1830",
            "::placeholder": { color: "#9ca3af" },
          },
        },
      });
      card.mount(cardRef.current);
      stripeCardRef.current = card;
      setFormLoading(false);
    };

    void init().catch(() => {
      if (!cancelled) {
        setError("We couldn't load the payment form.");
        setFormLoading(false);
      }
    });

    return () => {
      cancelled = true;
      stripeCardRef.current?.unmount();
      stripeCardRef.current = null;
    };
  }, [showAdd, paymentMethod?.stripeAccount, paymentMethod?.stripePublishableKey]);

  async function saveCard() {
    if (!stripeRef.current || !stripeCardRef.current) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const setupRes = await fetch(`/api/public/portal/${portalToken}/payment-methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const setupJson = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupJson.error || "Could not prepare payment form");

      const clientSecret = String(setupJson.data?.clientSecret || "");
      if (!clientSecret) throw new Error("Could not prepare payment form");

      const result = await stripeRef.current.confirmCardSetup(clientSecret, {
        payment_method: { card: stripeCardRef.current },
      });
      if (result.error) throw new Error(result.error.message || "Card could not be saved");

      const paymentMethodId =
        typeof result.setupIntent?.payment_method === "string"
          ? result.setupIntent.payment_method
          : result.setupIntent?.payment_method?.id;
      if (!paymentMethodId) throw new Error("Card could not be saved");

      const attachRes = await fetch(`/api/public/portal/${portalToken}/payment-methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach", paymentMethodId }),
      });
      const attachJson = await attachRes.json();
      if (!attachRes.ok) throw new Error(attachJson.error || "Card could not be saved");

      setMessage("Payment method saved.");
      setShowAdd(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card could not be saved");
    } finally {
      setLoading(false);
    }
  }

  async function removeCard() {
    if (!paymentMethod?.hasSavedCard) return;
    const label = paymentMethod.card?.last4
      ? `${(paymentMethod.card.brand || "Card").toUpperCase()} •••• ${paymentMethod.card.last4}`
      : "this payment method";
    if (!window.confirm(`Remove payment method?\n\n${label}\n\nThis card will no longer be available for future payments.`)) {
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/portal/${portalToken}/payment-methods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detach" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not remove payment method");
      setMessage("Payment method removed.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove payment method");
    } finally {
      setLoading(false);
    }
  }

  const canManage = Boolean(paymentMethod?.providerConfigured && paymentMethod?.stripePublishableKey);

  return (
    <section className="rounded-lg border p-4 text-sm" aria-labelledby="portal-payment-methods-heading">
      <h2 id="portal-payment-methods-heading" className="font-semibold">Payment methods</h2>
      <p className="mt-1 text-muted-foreground">Manage cards used for future eligible payments.</p>

      {paymentMethod?.hasSavedCard && paymentMethod.card ? (
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="font-medium">
              {(paymentMethod.card.brand || "Card").toUpperCase()} •••• {paymentMethod.card.last4}
            </p>
            {paymentMethod.card.expMonth && paymentMethod.card.expYear ? (
              <p className="text-muted-foreground">
                Expires {String(paymentMethod.card.expMonth).padStart(2, "0")}/{paymentMethod.card.expYear}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">Default</p>
          </div>
          {canManage ? (
            <button
              type="button"
              className="text-sm text-destructive underline disabled:opacity-50"
              disabled={loading}
              onClick={() => void removeCard()}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-muted-foreground">No saved payment method.</p>
      )}

      {canManage ? (
        <div className="mt-3">
          {!showAdd ? (
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={loading}
              onClick={() => {
                setShowAdd(true);
                setError(null);
                setMessage(null);
              }}
            >
              Add payment method
            </button>
          ) : (
            <div className="space-y-3 rounded-md border p-3">
              <p className="font-medium">Add payment method</p>
              {formLoading ? (
                <p className="text-muted-foreground" role="status">Preparing secure payment form…</p>
              ) : (
                <div ref={cardRef} className="rounded border px-3 py-3" />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  disabled
                />
                <span>Make this my default payment method</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  disabled={loading || formLoading}
                  onClick={() => void saveCard()}
                >
                  {loading ? "Saving…" : "Save payment method"}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                  disabled={loading}
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Saved card management is not available for this business yet.
        </p>
      )}

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
          {error.includes("payment form") ? (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setShowAdd(false);
                setTimeout(() => setShowAdd(true), 0);
              }}
            >
              Try again
            </button>
          ) : null}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-primary" role="status">{message}</p> : null}
    </section>
  );
}
