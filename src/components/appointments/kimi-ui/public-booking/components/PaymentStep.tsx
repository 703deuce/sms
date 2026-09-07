"use client";

import { useState } from "react";
import { BookingType } from "../mock-data";
import { Lock, CreditCard } from "lucide-react";

export function PaymentStep({
  type,
  onSuccess,
  onCancel,
}: {
  type: BookingType;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const payment = type.payment!;
  const cents =
    payment.mode === "deposit"
      ? payment.depositCents || Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))
      : payment.priceCents || 0;
  const amount = (cents / 100).toFixed(2);
  const currency = (payment.currency || "usd").toUpperCase();

  async function pay() {
    setPaying(true);
    setError("");
    // POST /api/public/book/{slug}/payment
    await new Promise((r) => setTimeout(r, 1200));
    if (card.replace(/\s/g, "").length < 12) {
      setError("Enter a valid card number to complete payment.");
      setPaying(false);
      return;
    }
    onSuccess();
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="tv-fade-up mx-auto max-w-md">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-[16px] font-semibold text-foreground">Complete payment</h2>
            <p className="text-[12px] text-muted-foreground">
              {payment.mode === "deposit" ? "A deposit is required to hold your time." : "Payment is required to confirm your booking."}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">{type.name}{payment.mode === "deposit" ? " — deposit" : ""}</span>
            <span className="font-display text-[15px] font-bold text-foreground">${amount} {currency}</span>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> Processed securely by Square. Card details are never stored by Transovo.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="card" className="text-[12px] font-semibold text-foreground">Card number</label>
            <input id="card" inputMode="numeric" placeholder="4242 4242 4242 4242" className={`mt-1.5 ${inputCls}`} value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="exp" className="text-[12px] font-semibold text-foreground">Expiry</label>
              <input id="exp" placeholder="MM / YY" className={`mt-1.5 ${inputCls}`} value={exp} onChange={(e) => setExp(e.target.value)} />
            </div>
            <div>
              <label htmlFor="cvc" className="text-[12px] font-semibold text-foreground">CVC</label>
              <input id="cvc" inputMode="numeric" placeholder="123" className={`mt-1.5 ${inputCls}`} value={cvc} onChange={(e) => setCvc(e.target.value)} />
            </div>
          </div>
        </div>

        {error ? <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={paying}
            className="rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={pay}
            disabled={paying}
            className="flex-1 rounded-lg px-5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {paying ? "Processing…" : `Pay $${amount}`}
          </button>
        </div>
      </div>
    </div>
  );
}
