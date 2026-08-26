import { redirect } from "next/navigation";
import { MassTextingBillingPanel } from "@/components/mass-texting/mass-texting-billing-panel";

export default function MassTextSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Mass Texting settings</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Billing, usage, and plan management for Mass Texting.
        </p>
      </div>
      <MassTextingBillingPanel />
    </div>
  );
}
