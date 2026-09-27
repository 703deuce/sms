"use client";

import { usePathname } from "next/navigation";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { LinkTabs } from "@/newui-transplant/components/app/link-tabs";
import { SETTINGS_TABS } from "@/newui-transplant/lib/nav";

const OPUS_SETTINGS_PATHS = new Set(["/settings/business", "/settings/team", "/settings/billing"]);

export function SettingsWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname || !OPUS_SETTINGS_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  const title =
    pathname === "/settings/billing"
      ? "Billing"
      : pathname === "/settings/team"
        ? "Team"
        : "Business settings";

  const description =
    pathname === "/settings/billing"
      ? "Subscription, payment method, and invoices."
      : pathname === "/settings/team"
        ? "Users, roles, and invitations for this workspace."
        : "Workspace profile, messaging registration, and booking defaults.";

  return (
    <Page>
      <PageHeader title={title} description={description} />
      <LinkTabs tabs={SETTINGS_TABS} label="Settings sections" />
      <div className="mt-6 min-w-0">{children}</div>
    </Page>
  );
}
