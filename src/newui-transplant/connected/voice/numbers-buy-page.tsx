"use client";

import { PremiumNumbersPageClient } from "@/components/numbers/premium-numbers-page";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

export function NewUiVoiceNumbersBuyPage({ workspaceId }: { workspaceId: string }) {
  return (
    <Page>
      <PageHeader
        title="Add number"
        description="Search memorable local or toll-free numbers for your business line."
        actions={<ButtonLink href="/voice/numbers" variant="outline">Back to numbers</ButtonLink>}
      />
      <PremiumNumbersPageClient
        workspaceId={workspaceId}
        initialMode="business"
        layout="default"
        hidePageChrome
      />
    </Page>
  );
}
