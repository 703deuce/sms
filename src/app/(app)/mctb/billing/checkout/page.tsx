"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { startPlatformProductCheckout } from "@/lib/mctb/start-platform-checkout";

const ALLOWED = new Set(["mctb_pro", "mctb_text_back", "mctb_own_sender"]);

export default function MctbBillingCheckoutPage() {
  const searchParams = useSearchParams();
  const productKey = useMemo(
    () => String(searchParams.get("product") || "mctb_pro").trim(),
    [searchParams],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ALLOWED.has(productKey)) {
      setError("Unknown product.");
      return;
    }
    let cancelled = false;
    void startPlatformProductCheckout({
      productKey,
      successPath: "/mctb",
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Checkout could not start.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [productKey]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Opening secure checkout…</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        If you are not redirected, sign in and try again.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      <Link href="/mctb" className="mt-6 inline-block text-sm font-medium text-primary underline">
        Back to Missed Call Text Back
      </Link>
    </div>
  );
}
