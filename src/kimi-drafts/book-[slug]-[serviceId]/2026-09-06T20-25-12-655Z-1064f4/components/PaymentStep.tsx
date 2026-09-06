import { useState } from "react";
import type { PaymentRequirement } from "../mock-data";
import { Button, Card, Input, Label } from "./ui";
import { formatPrice } from "./utils";
import { CreditCard, Lock } from "lucide-react";

export function PaymentStep({
  payment,
  onSuccess,
  onCancel,
}: {
  payment: PaymentRequirement;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");

  const priceLabel = formatPrice(payment) || "";
  const amount = payment.mode === "deposit"
    ? ((payment.depositCents || Math.round((payment.priceCents || 0) * ((payment.depositPercent || 0) / 100))) / 100).toFixed(2)
    : ((payment.priceCents || 0) / 100).toFixed(2);

  async function pay() {
    setError("");
    if (!name.trim()) return setError("Enter the name on the card.");
    if (cardNumber.replace(/\D/g, "").length < 15) return setError("Enter a complete card number.");
    if (!expiry.trim()) return setError("Enter the card expiration date.");
    if (cvc.replace(/\D/g, "").length < 3) return setError("Enter the card security code.");
    setPaying(true);
    // Sandbox: simulate the Square tokenize + payment POST round trip
    await new Promise((r) => setTimeout(r, 1400));
    setPaying(false);
    onSuccess();
  }

  return (
    <Card className="fade-in p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold">Complete payment</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {priceLabel} — processed securely by Square. Card details are never stored by Transovo.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="cardName">Name on card</Label>
          <Input id="cardName" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cardNumber">Card number</Label>
          <div className="relative">
            <Input
              id="cardNumber"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) =>
                setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim())
              }
            />
            <CreditCard className="pointer-events-none absolute right-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expiry">Expiration</Label>
            <Input id="expiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cvc">Security code</Label>
            <Input id="cvc" inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p> : null}

      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={onCancel} disabled={paying}>Cancel</Button>
        <Button className="flex-1" onClick={pay} disabled={paying}>
          {paying ? "Processing…" : `Pay $${amount}`}
        </Button>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" /> Secured by Square · PCI-compliant checkout
      </p>
    </Card>
  );
}
