"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";

type PaymentPollState = "pending" | "succeeded" | "failed" | "timeout";

export function PaymentSuccessClient({
  appointmentId,
  sessionId,
}: {
  appointmentId?: string;
  sessionId?: string;
}) {
  const [state, setState] = useState<PaymentPollState>("pending");
  const [details, setDetails] = useState<{
    amountPaidCents?: number | null;
    balanceDueCents?: number | null;
    paymentMode?: string | null;
  }>({});

  useEffect(() => {
    if (!appointmentId) {
      setState("succeeded");
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/public/appointment-payment/status?appointmentId=${encodeURIComponent(appointmentId!)}`,
        );
        const json = await res.json();
        if (res.ok && json.data?.paid) {
          setDetails({
            amountPaidCents: json.data.amountPaidCents,
            balanceDueCents: json.data.balanceDueCents,
            paymentMode: json.data.paymentMode,
          });
          setState("succeeded");
          return;
        }
        if (json.data?.paymentStatus === "failed") {
          setState("failed");
          return;
        }
      } catch {
        // retry
      }
      if (attempts >= maxAttempts) {
        setState("timeout");
        return;
      }
      window.setTimeout(poll, 2000);
    }

    poll();
  }, [appointmentId]);

  if (state === "pending") {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h1 className="font-display text-xl font-semibold">Confirming payment…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we verify your payment. Do not close this page.
        </p>
        {sessionId ? (
          <p className="mt-4 text-xs text-muted-foreground">Session: {sessionId.slice(0, 20)}…</p>
        ) : null}
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-rose-700">Payment not completed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment could not be confirmed. You can return to the booking page and try again.
        </p>
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline">
          Return home
        </Link>
      </div>
    );
  }

  const paidLabel =
    details.paymentMode === "deposit" && details.amountPaidCents
      ? `Deposit of $${(details.amountPaidCents / 100).toFixed(2)} received`
      : details.amountPaidCents
        ? `$${(details.amountPaidCents / 100).toFixed(2)} paid`
        : null;

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="h-6 w-6" />
      </div>
      <h1 className="font-display text-xl font-semibold">
        {state === "timeout" ? "Payment submitted" : "Payment received"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {state === "timeout"
          ? "Your payment may still be processing. You'll receive a confirmation shortly if it succeeds."
          : "Your appointment payment was successful. You'll receive a confirmation shortly."}
      </p>
      {paidLabel ? <p className="mt-3 text-sm font-medium text-foreground">{paidLabel}</p> : null}
      {details.balanceDueCents && details.balanceDueCents > 0 ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          Remaining balance: ${(details.balanceDueCents / 100).toFixed(2)}
        </p>
      ) : null}
      {appointmentId ? (
        <p className="mt-4 text-xs text-muted-foreground">Reference: {appointmentId}</p>
      ) : null}
      <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline">
        Return home
      </Link>
    </div>
  );
}
