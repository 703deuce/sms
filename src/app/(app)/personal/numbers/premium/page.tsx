import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { PersonalPageWrap } from "@/components/personal/personal-ui";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalPremiumNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();

  return (
    <PersonalPageWrap>
      <PremiumNumbersPageClient
        workspaceId={workspaceId}
        initialMode="personal"
        layout="find-mockup"
      />
    </PersonalPageWrap>
  );
}
