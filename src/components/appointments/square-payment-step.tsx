"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createId } from "@/lib/supabase/id";

type SquareConfig = {
  applicationId: string;
  locationId: string;
  amountCents: number;
  currency: string;
  sandbox?: boolean;
};

declare global {
  interface Window {
    Square?: {
      payments: (applicationId: string, locationId: string) => {
        card: () => Promise<{
          attach: (el: HTMLElement) => Promise<void>;
          tokenize: () => Promise<{ status: string; token?: string; errors?: unknown }>;
        }>;
      };
    };
  }
}

export function SquarePaymentStep({
  slug,
  appointmentId,
  square,
  onSuccess,
  onCancel,
}: {
  slug: string;
  appointmentId: string;
  square: SquareConfig;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const cardInstance = useRef<{ tokenize: () => Promise<{ status: string; token?: string }> } | null>(null);

  useEffect(() => {
    const scriptId = "square-web-payments-sdk";
    const init = async () => {
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = square.sandbox
          ? "https://sandbox.web.squarecdn.com/v1/square.js"
          : "https://web.squarecdn.com/v1/square.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }
      if (!window.Square || !cardRef.current) return;
      const payments = window.Square.payments(square.applicationId, square.locationId);
      const card = await payments.card();
      await card.attach(cardRef.current);
      cardInstance.current = card;
      setLoading(false);
    };
    init().catch(() => {
      setError("Could not load Square payment form");
      setLoading(false);
    });
  }, [square.applicationId, square.locationId]);

  async function pay() {
    if (!cardInstance.current) return;
    setPaying(true);
    setError("");
    try {
      const result = await cardInstance.current.tokenize();
      if (result.status !== "OK" || !result.token) {
        throw new Error("Card tokenization failed");
      }
      const res = await fetch(`/api/public/book/${encodeURIComponent(slug)}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          sourceId: result.token,
          idempotencyKey: createId(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment failed");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  const amount = (square.amountCents / 100).toFixed(2);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold">Complete payment</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Pay ${amount} {square.currency} securely with Square. Card details are processed by Square — never stored by Transovo.
      </p>
      <div ref={cardRef} className="mt-4 min-h-[120px] rounded-lg border border-border p-3" />
      {loading ? <p className="mt-2 text-sm text-muted-foreground">Loading secure payment form…</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={paying}>Cancel</Button>
        <Button className="flex-1" onClick={pay} disabled={loading || paying}>
          {paying ? "Processing…" : `Pay $${amount}`}
        </Button>
      </div>
    </Card>
  );
}
