import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  ensureMessagingProductRegistration,
  getMessagingProductRegistration,
} from "@/lib/mass-texting/messaging-registration";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import Link from "next/link";
import { Shield } from "lucide-react";

export default async function MassTextCompliancePage() {
  const { workspaceId } = await requireWorkspaceContext();
  await ensureMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  const registration = await getMessagingProductRegistration(
    workspaceId,
    "MASS_TEXT_MARKETING",
  );
  const billing = await getMassTextingBillingSummary(workspaceId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Mass Texting compliance</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Promotional bulk SMS uses a separate marketing A2P registration from Missed Call Text Back.
        </p>
      </div>

      <section className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-amber-700" />
          <div>
            <h2 className="font-semibold text-amber-950">A2P separation</h2>
            <p className="mt-1 text-[13px] text-amber-900/90">
              MCTB press-1 or existing-consent flows do <strong>not</strong> authorize Mass Texting
              promotional campaigns. Each product maintains its own 10DLC use case (
              <code className="text-[12px]">MASS_TEXT_MARKETING</code> vs{" "}
              <code className="text-[12px]">MCTB_CUSTOMER_CARE</code>).
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border border-border bg-card p-5">
        <h2 className="text-[16px] font-semibold">Marketing A2P registration</h2>
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{registration?.overallStatus ?? "not_started"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Messaging enabled</dt>
            <dd>{registration?.messagingEnabled ? "Yes" : "No"}</dd>
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
            <dt className="text-muted-foreground">Trial segments remaining</dt>
            <dd>{billing.trialSegmentsRemaining}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">A2P fee status</dt>
            <dd>{billing.a2pFeeStatus}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Shared workspace compliance tools (brand profile, opt-out handling) live in the main
          compliance center.
        </p>
        <Link href="/compliance" className="mt-3 inline-block text-[13px] font-medium text-primary hover:underline">
          Open shared compliance center →
        </Link>
      </section>
    </div>
  );
}
