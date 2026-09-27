"use client";

import { useCallback, useEffect, useState } from "react";
import type { PremiumCheckoutState } from "@/components/numbers/premium-number-checkout";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import {
  calcReservationRemaining,
  completePremiumCheckout,
  formatReservationCountdown,
} from "@/lib/premium-numbers/premium-checkout-actions";
import { Button } from "@/newui-transplant/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";

export function PremiumCheckoutOpusDialog({
  state,
  workspaceId,
  onClose,
  onComplete,
}: {
  state: PremiumCheckoutState;
  workspaceId: string;
  onClose: () => void;
  onComplete: (result: { phoneNumberId?: string; e164?: string }) => void;
}) {
  const [remaining, setRemaining] = useState(() => calcReservationRemaining(state.expiresAt));
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/numbers/premium/reservation/${state.reservationId}?workspaceId=${workspaceId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.reservationExpiresAt) {
        setRemaining(calcReservationRemaining(data.reservationExpiresAt));
      }
    } catch {
      // ignore
    }
  }, [state.reservationId, workspaceId]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(calcReservationRemaining(state.expiresAt));
      void refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [state.expiresAt, refresh]);

  const headline = state.vanityDisplay ?? state.displayNumber ?? state.phoneNumber;
  const expired = remaining <= 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reserved for you</DialogTitle>
          <DialogDescription>Complete purchase before the reservation expires.</DialogDescription>
        </DialogHeader>
        <p className="font-mono text-xl font-semibold">{headline}</p>
        {state.vanityDisplay ? <p className="text-sm text-muted-foreground">{state.displayNumber}</p> : null}
        <p className="text-lg font-semibold">{formatPremiumPrice(state.premiumPriceCents)} <span className="text-sm font-normal text-muted-foreground">one-time</span></p>
        <p className="text-sm text-muted-foreground">
          {expired ? "Reservation expired — search again." : `Time remaining: ${formatReservationCountdown(remaining)}`}
        </p>
        {purchaseError ? <p className="text-sm text-destructive" role="alert">{purchaseError}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={purchasing}>Back</Button>
          <Button
            type="button"
            disabled={expired || purchasing}
            onClick={async () => {
              setPurchasing(true);
              setPurchaseError("");
              try {
                const result = await completePremiumCheckout(workspaceId, state);
                if (result.phoneNumberId || result.e164) onComplete(result);
              } catch (err) {
                setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
              } finally {
                setPurchasing(false);
              }
            }}
          >
            {purchasing ? "Processing…" : "Complete purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
