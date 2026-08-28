import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import { getSegmentAvailability } from "@/lib/mass-texting/credit-accounting";
import { getBillingSummary } from "@/lib/settings/billing";
import Link from "next/link";
import { Shield } from "lucide-react";

export default async function MassTextCompliancePage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [registration, billing, credits, workspaceBilling] = await Promise.all([
    getRegistrationByWorkspace(workspaceId),
    getMassTextingBillingSummary(workspaceId),
    getSegmentAvailability(workspaceId),
    getBillingSummary(workspaceId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Mass Texting compliance</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Campaigns share the same workspace 10DLC registration and SMS credits as Missed Call Text
          Back (low-volume mixed use case).
        </p>
      </div>

      <section className="rounded-[14px] border border-emerald-200 bg-emerald-50/60 p-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <h2 className="font-semibold text-emerald-950">Shared A2P + credits</h2>
            <p className="mt-1 text-[13px] text-emerald-900/90">
              One approved low-volume / mixed 10DLC campaign on your sending number covers MCTB
              consent texts and promotional broadcasts. Workspace credits are shared across both
              products.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-border bg-card p-5">
        <h2 className="text-[16px] font-semibold">Workspace messaging registration</h2>
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{registration?.overallStatus ?? "not_started"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Use case</dt>
            <dd>{registration?.useCase ?? "mixed"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Number attached</dt>
            <dd>{registration?.phoneAttached ? registration.phoneE164 || "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing lifecycle</dt>
            <dd>{billing.lifecycleState}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shared credits available</dt>
            <dd>{credits.available} segments</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Workspace balance</dt>
            <dd>${workspaceBilling.balance.toFixed(2)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Brand profile, campaign setup, and opt-out handling live in the main compliance center.
        </p>
        <Link href="/compliance" className="mt-3 inline-block text-[13px] font-medium text-primary hover:underline">
          Open shared compliance center →
        </Link>
      </section>
    </div>
  );
}
