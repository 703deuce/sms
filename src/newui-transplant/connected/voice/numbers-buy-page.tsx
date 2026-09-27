"use client";

import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { PremiumNumbersBuyOpusView } from "@/newui-transplant/connected/voice/premium-numbers-buy-opus-view";

export function NewUiVoiceNumbersBuyPage({ workspaceId }: { workspaceId: string }) {
  return (
    <Page>
      <PageHeader
        title="Add number"
        description="Search memorable local or toll-free numbers for your business line."
        actions={<ButtonLink href="/voice/numbers" variant="outline">Back to numbers</ButtonLink>}
      />
      <PremiumNumbersBuyOpusView workspaceId={workspaceId} />
    </Page>
  );
}
