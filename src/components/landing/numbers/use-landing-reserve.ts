"use client";

import type { PremiumNumberProductResult } from "@/lib/premium-numbers/product-api";
import { trackNumbersLandingEvent } from "@/lib/premium-numbers/landing-analytics";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useLandingReserve() {
  const router = useRouter();
  const [reserving, setReserving] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState("");

  async function reserveNumber(result: PremiumNumberProductResult, searchLogId: string | undefined) {
    if (!searchLogId) {
      setReserveError("Search session expired — search again.");
      return;
    }
    setReserving(result.phoneNumber);
    setReserveError("");
    trackNumbersLandingEvent("number_reserve_clicked", { phoneNumber: result.phoneNumber });
    try {
      const res = await fetch("/api/public/numbers/reserve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: result.phoneNumber,
          searchLogId,
          searchMode: "personal",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reserve this number");
      if (data.signupUrl) {
        trackNumbersLandingEvent("checkout_started", { phoneNumber: result.phoneNumber });
        router.push(data.signupUrl);
        return;
      }
      throw new Error("Reservation did not return checkout URL");
    } catch (err) {
      setReserveError(err instanceof Error ? err.message : "Reservation failed");
    } finally {
      setReserving(null);
    }
  }

  return { reserving, reserveError, reserveNumber, setReserveError };
}
