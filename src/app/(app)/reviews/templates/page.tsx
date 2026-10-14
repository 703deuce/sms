import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { TemplatesManager } from "@/components/reputation/templates-manager";
import { PageHeader } from "@/components/ui/page-header";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationTemplatesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  // Use TemplatesManager (real create/edit/duplicate/archive/test-send APIs).
  // TemplatesHub is a visual mock and left unused until it is wired to the same APIs.
  return (
    <div className="space-y-4">
      <PageHeader
        title="Templates"
        description="Create and manage SMS and email templates for review requests."
      />
      <TemplatesManager businessId={businessId} />
    </div>
  );
}