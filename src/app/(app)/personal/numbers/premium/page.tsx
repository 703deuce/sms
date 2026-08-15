import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { PersonalPageHeader, PersonalPageWrap } from "@/components/personal/personal-ui";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalPremiumNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Find a Number"
        description="Search premium and memorable numbers for your Personal workspace."
      />
      <PremiumNumbersPageClient workspaceId={workspaceId} initialMode="personal" />
    </PersonalPageWrap>
  );
}
