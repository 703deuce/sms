import { Suspense } from "react";
import { MerchantPaymentsSettingsPanel } from "@/components/settings/merchant-payments-settings-panel";

export default function IntegrationsPaymentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading payments…</div>}>
      <MerchantPaymentsSettingsPanel variant="integrations" />
    </Suspense>
  );
}
