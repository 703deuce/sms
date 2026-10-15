import Link from "next/link";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewAlertSettings } from "@/components/reputation/review-alert-settings";
import { ReputationSettingsForm } from "@/components/reputation/reputation-settings-form";
import { PageHeader, Panel } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { ReviewsOpusPage } from "@/newui-transplant/connected/reviews/reviews-opus-page";
import { reviewQrRoutes } from "@/lib/reviews/qr-routes";
export default async function ReputationSettingsPage() {
  const businessId = await getReputationWorkspaceId();
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return (
    <ReviewsOpusPage>
      <PageHeader
        title="Reputation Settings"
        description="Business-level reputation configuration, alert preferences, and links to QR poster tools."
      />
      <div className="flex flex-col gap-4">
        <ReputationSettingsForm businessId={businessId} />
        <Panel
          title="QR campaigns & tracked review link"
          description="Manage printable Google review QR placements, brand colors, tracked links, and scan analytics."
          action={
            <Button asChild>
              <Link href={reviewQrRoutes.list}>Open QR Campaigns</Link>
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            QR campaigns live under Review Requests when your plan includes placements and analytics.
          </p>
        </Panel>
        <ReviewAlertSettings businessId={businessId} />
      </div>
    </ReviewsOpusPage>
  );
}
