"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type LinkInfo = {
  id: string;
  amountCents: number;
  currency: string;
  description: string | null;
  status: string;
};

export default function MockPaymentPage() {
  const params = useParams<{ linkId: string }>();
  const router = useRouter();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/public/payments/${params.linkId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) setError(j.error || "Payment link not found");
        else setLink(j.data);
      })
      .catch(() => setError("Failed to load payment link"));
  }, [params.linkId]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/payments/${params.linkId}/pay`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment failed");
      setLink(json.data);
      router.replace(`/messaging/payments/mock/${params.linkId}?paid=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (error && !link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md p-6 text-center text-sm text-muted-foreground">{error}</Card>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-muted-foreground">
        Loading payment…
      </div>
    );
  }

  const amount = (link.amountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: (link.currency || "usd").toUpperCase(),
  });
  const paid = link.status === "paid";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50 to-slate-100 p-6">
      <Card className="w-full max-w-md space-y-5 p-6 shadow-lg">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {paid ? "Payment received" : "Secure checkout (dev)"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {link.description || "Payment"}
          </h1>
          <p className="mt-2 text-3xl font-semibold text-violet-800">{amount}</p>
        </div>
        {paid ? (
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-800">
            Thanks — this payment is marked paid. Campaign reminders will stop automatically.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Stripe is not configured in this environment. Confirming here simulates a successful
              checkout and updates the payment link status.
            </p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" onClick={pay} disabled={paying}>
              {paying ? "Processing…" : `Pay ${amount}`}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
