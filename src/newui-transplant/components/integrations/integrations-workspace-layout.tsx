"use client";

import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { LinkTabs } from "@/newui-transplant/components/app/link-tabs";
import { INTEGRATION_TABS } from "@/newui-transplant/lib/nav";

/** Shared integrations chrome — route bodies stay functionally unchanged below tabs. */
export function IntegrationsWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Page>
      <PageHeader
        title="Integrations"
        description="Connect Transovo with the tools you already use."
      />
      <LinkTabs tabs={INTEGRATION_TABS} label="Integration sections" />
      <div className="mt-6 min-w-0">{children}</div>
    </Page>
  );
}
