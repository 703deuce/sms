import { AutomationsHub } from "@/components/reputation/automations-hub";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { reputationAutomationsPreviewData } from "@/lib/reputation/reputation-page-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationAutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  return (
    <AutomationsHub
      businessId={businessId}
      previewData={isPreview ? reputationAutomationsPreviewData : undefined}
    />
  );
}