import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function PersonalBillingPage() {
  return (
    <div>
      <PageHeader
        title="Billing / Plan"
        description="Personal workspace usage and plan details."
      />
      <div className="surface max-w-lg space-y-3 rounded-xl p-5 text-sm">
        <p>
          Billing is shared across your Transovo account. View payment methods and invoices in
          account settings.
        </p>
        <Link href="/settings/billing" className="font-medium text-primary">
          Open account billing settings
        </Link>
        <p className="text-muted-foreground">
          Workspace-specific plan wiring for Personal vault and forwarding will be connected in a
          follow-up billing pass.
        </p>
      </div>
    </div>
  );
}
