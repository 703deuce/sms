"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";

type LinkInfo = {
  id: string;
  amountCents: number;
  currency: string;
  description: string | null;
  status: string;
};

export default function PublicPaymentLinkClient({ linkId }: { linkId: string }) {
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`/api/public/payments/${linkId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.data) setError(j.error || "This payment link is not available.");
        else setLink(j.data);
      })
      .catch(() => setError("We couldn't load this payment link. Please contact the business."));
  }, [linkId]);

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/payments/${linkId}/pay`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment wasn't completed.");
      setLink(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment wasn't completed.");
    } finally {
      setPaying(false);
    }
  }

  if (error && !link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md p-6 text-center text-sm text-muted-foreground">{error}</Card>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const amount = (link.amountCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: (link.currency || "usd").toUpperCase(),
  });
  const paid = link.status === "paid";

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md space-y-5 p-6 shadow-lg">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {paid ? "Payment received" : "Secure payment"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{link.description || "Payment"}</h1>
          <p className="mt-2 text-3xl font-semibold">{amount}</p>
        </div>
        {paid ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Thanks — your payment is complete.
          </p>
        ) : (
          <>
            {error ? <p className="text-sm text-rose-600" role="alert">{error}</p> : null}
            <Button className="w-full" onClick={pay} disabled={paying}>
              {paying ? "Processing…" : `Pay ${amount}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Payment wasn&apos;t completed? Try again or contact the business.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
