import { FaxSubnav } from "@/components/fax/fax-subnav";
import { FaxBillingPanel } from "@/components/fax/fax-billing-panel";

export default function FaxBillingPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Fax Billing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Transparent pricing, usage, and subscription management.
      </p>
      <div className="mt-6">
        <FaxSubnav />
      </div>
      <div className="mt-6">
        <FaxBillingPanel />
      </div>
    </div>
  );
}
