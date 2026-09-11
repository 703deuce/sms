import { Suspense } from "react";
import { PricingPaymentsClient } from "@/components/appointments/pricing-payments-client";

export default function PricingPaymentsPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-[var(--surface-muted)]" aria-busy="true" />}>
      <PricingPaymentsClient />
    </Suspense>
  );
}
