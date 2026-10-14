import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ContactsPageClient } from "@/components/reputation/contacts-page-client";
import {
  REPUTATION_CONTACTS_PREVIEW_TOTAL,
  reputationContactsPreviewData,
  reputationContactsPreviewKpis,
} from "@/lib/reputation/reputation-page-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationContactsPage() {
  const businessId = await getReputationWorkspaceId();
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  return (
    <ContactsPageClient
      businessId={businessId}
      allowed={allowed}
      initialContacts={isPreview ? reputationContactsPreviewData : undefined}
      previewStats={isPreview ? reputationContactsPreviewKpis : undefined}
      previewTotalCount={isPreview ? REPUTATION_CONTACTS_PREVIEW_TOTAL : undefined}
    />
  );
}