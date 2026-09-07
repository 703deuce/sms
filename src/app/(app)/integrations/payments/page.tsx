import { Suspense } from "react";
import { PaymentsIntegrationsConnected } from "@/features/integrations/kimi/payments/payments-connected";

export default function IntegrationsPaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading payments…</div>}>
      <PaymentsIntegrationsConnected />
    </Suspense>
  );
}
