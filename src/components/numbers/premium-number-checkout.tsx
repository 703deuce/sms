"use client";

import { Button } from "@/components/ui/button";
import { srCard } from "@/components/smart-routing/shared";
import { formatPremiumPrice } from "@/lib/premium-numbers/premium-pricing";
import { isNumbersPlatformOnlyLaunch } from "@/lib/workspace/platform-launch";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Forward,
  MessageSquare,
  Phone,
  Vault,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type PremiumCheckoutState = {
  reservationId: string;
  phoneNumber: string;
  vanityDisplay?: string;
  displayNumber?: string;
  premiumPriceCents: number;
  expiresAt: string;
  phoneNumberId?: string;
  e164?: string;
};

function calcRemaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PremiumCheckoutModal({
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
  const [remaining, setRemaining] = useState(() => calcRemaining(state.expiresAt));
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
        setRemaining(calcRemaining(data.reservationExpiresAt));
      }
    } catch {
      // ignore
    }
  }, [state.reservationId, workspaceId]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(calcRemaining(state.expiresAt));
      refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [state.expiresAt, refresh]);

  const headline = state.vanityDisplay ?? state.displayNumber ?? state.phoneNumber;
  const expired = remaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-xl">
        <h3 className="text-[18px] font-bold">Reserved for you</h3>
        <p className="mt-2 text-[26px] font-bold text-[#6366f1]">{headline}</p>
        {state.vanityDisplay && (
          <p className="text-[14px] text-[#6b7280]">{state.displayNumber}</p>
        )}
        <div className="mt-4 rounded-lg bg-[#f5f3ff] p-4">
          <p className="text-[20px] font-bold">
            {formatPremiumPrice(state.premiumPriceCents)}
            <span className="text-[12px] font-normal text-[#6b7280]"> one-time premium</span>
          </p>
        </div>
        <p className="mt-4 text-[13px] text-[#6b7280]">
          {expired ? "Reservation expired — search again." : `Time remaining: ${formatCountdown(remaining)}`}
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-lg" onClick={onClose} disabled={purchasing}>
            Back
          </Button>
          <Button
            className="flex-1 rounded-lg bg-[#6366f1] hover:bg-[#5558e3]"
            disabled={expired || purchasing}
            onClick={async () => {
              setPurchasing(true);
              setPurchaseError("");
              try {
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
                onComplete({ phoneNumberId: data.phoneNumberId, e164: data.e164 });
              } catch (err) {
                setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
              } finally {
                setPurchasing(false);
              }
            }}
          >
            {purchasing ? "Purchasing…" : "Complete purchase (test payment)"}
          </Button>
        </div>
        {purchaseError ? (
          <p className="mt-3 text-[13px] text-red-600">{purchaseError}</p>
        ) : null}
      </div>
    </div>
  );
}

export function PremiumSuccessPanel({
  state,
  onClose,
}: {
  state: PremiumCheckoutState;
  onClose: () => void;
}) {
  const headline = state.vanityDisplay ?? state.displayNumber ?? state.phoneNumber;
  const personalV1 = isNumbersPlatformOnlyLaunch();
  const services = personalV1
    ? [
        { label: "Park This Number", href: "/personal/vault", icon: Vault },
        { label: "Forward Calls", href: "/personal/forwarding", icon: Forward },
        { label: "Set Up Voicemail", href: "/personal/voicemail", icon: Phone },
      ]
    : [
        { label: "Park This Number", href: "/numbers", icon: Vault },
        { label: "Forward Calls", href: "/phone/settings", icon: Forward },
        { label: "Smart Routing", href: "/smart-routing", icon: Phone },
        { label: "AI Receptionist", href: "/voice/receptionist", icon: Brain },
        { label: "Business Texting", href: "/compliance", icon: MessageSquare },
      ];

  return (
    <div className={cn(srCard, "border-[#e0e7ff] bg-[#faf5ff] p-6")}>
      <CheckCircle2 className="h-6 w-6 text-[#6366f1]" />
      <h2 className="mt-2 text-[18px] font-bold">Your number is ready</h2>
      <p className="mt-1 text-[24px] font-bold">{headline}</p>
      {state.vanityDisplay && (
        <p className="text-[13px] text-[#6b7280]">{state.displayNumber}</p>
      )}
      <p className="mt-4 text-[14px] font-semibold">What would you like this number to do?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3 text-[13px] font-medium hover:border-[#c7d2fe]"
          >
            <s.icon className="h-4 w-4 text-[#6366f1]" />
            {s.label}
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-[#9ca3af]" />
          </Link>
        ))}
      </div>
      <Button variant="outline" className="mt-4 rounded-lg" onClick={onClose}>Close</Button>
    </div>
  );
}
