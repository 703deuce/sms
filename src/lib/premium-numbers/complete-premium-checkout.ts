import type { PremiumCheckoutState } from "@/components/numbers/premium-number-checkout";

export async function completePremiumCheckout(
  workspaceId: string,
  state: PremiumCheckoutState,
): Promise<{ phoneNumberId?: string; e164?: string }> {
  const checkoutRes = await fetch("/api/numbers/premium/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      reservationId: state.reservationId,
    }),
  });
  const checkoutData = await checkoutRes.json();
  if (checkoutRes.ok && checkoutData.checkoutUrl) {
    window.location.href = checkoutData.checkoutUrl;
    return {};
  }
  if (checkoutRes.status !== 409 || !checkoutData.testPayment) {
    throw new Error(checkoutData.error || "Checkout failed");
  }

  const res = await fetch("/api/numbers/premium/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      reservationId: state.reservationId,
      idempotencyKey: `premium:${state.reservationId}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.status || "Purchase failed");
  }
  return { phoneNumberId: data.phoneNumberId, e164: data.e164 };
}

export function calcReservationRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatReservationCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
