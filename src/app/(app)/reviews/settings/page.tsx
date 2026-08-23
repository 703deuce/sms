import Link from "next/link";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewAlertSettings } from "@/components/reputation/review-alert-settings";
import { ReputationSettingsForm } from "@/components/reputation/reputation-settings-form";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationSettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return (
    <ModulePage>
      <PageHeader
        title="Reputation Settings"
        description="Business-level reputation configuration, alert preferences, and links to QR poster tools."
      />
      <div className="mt-3 space-y-3">
        <ReputationSettingsForm businessId={businessId} />
        <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-[#101828]">QR campaigns & tracked review link</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Manage printable Google review QR placements, brand colors, tracked links, and scan
            analytics.
          </p>
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns`}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-[#0f6244]"
          >
            Open QR Campaigns
          </Link>
        </div>
        <ReviewAlertSettings businessId={businessId} />
      </div>
    </ModulePage>
  );
}