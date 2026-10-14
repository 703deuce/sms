"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AR_SERVICE_TABS,
  CAMPAIGNS_SERVICE_TABS,
  CONTACTS_WORKSPACE_TABS,
  MCTB_SERVICE_TABS,
  isInboxWorkspacePath,
  shouldShowArServiceTabs,
  shouldShowCampaignsServiceTabs,
  shouldShowContactsWorkspaceTabs,
  shouldShowMctbServiceTabs,
} from "@/lib/products/business-messaging-nav";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { isBusinessMessagingUnifiedNav } from "@/lib/workspace/platform-launch";
import { InboxWorkspaceTabs } from "@/newui-transplant/components/app/inbox-workspace-tabs";
import { ServiceWorkspaceTabs } from "@/newui-transplant/components/app/service-workspace-tabs";
import { Button } from "@/newui-transplant/components/ui/button";

function MctbServiceActions() {
  return (
    <Button variant="outline" size="sm" render={<Link href={MCTB_ROUTES.setup} />}>
      Setup
    </Button>
  );
}

function ArServiceActions() {
  return (
    <Button variant="outline" size="sm" render={<Link href={AR_ROUTES.settings} />}>
      Settings
    </Button>
  );
}

/** Service / inbox / contacts tab chrome for unified Business Messaging nav. */
export function BusinessMessagingRouteChrome() {
  const pathname = usePathname() ?? "";
  if (!isBusinessMessagingUnifiedNav()) return null;

  if (shouldShowMctbServiceTabs(pathname)) {
    return (
      <ServiceWorkspaceTabs
        title="Missed Call Text Back"
        description="Recover missed calls with compliant text-back and conversation follow-up."
        tabs={MCTB_SERVICE_TABS}
        actions={<MctbServiceActions />}
        compact={pathname === MCTB_ROUTES.home}
      />
    );
  }

  if (shouldShowArServiceTabs(pathname)) {
    return (
      <ServiceWorkspaceTabs
        title="Appointment Reminders"
        description="Synced calendar reminders, confirmations, and SMS rescheduling."
        tabs={AR_SERVICE_TABS}
        actions={<ArServiceActions />}
      />
    );
  }

  if (shouldShowCampaignsServiceTabs(pathname) || pathname.startsWith("/sms/analytics")) {
    return (
      <ServiceWorkspaceTabs
        title="Campaigns"
        description="Business SMS announcements and promotional alerts."
        tabs={CAMPAIGNS_SERVICE_TABS}
        actions={
          <Button variant="default" size="sm" render={<Link href="/campaigns/new" />}>
            Create campaign
          </Button>
        }
      />
    );
  }

  if (shouldShowContactsWorkspaceTabs(pathname)) {
    return (
      <ServiceWorkspaceTabs
        title="Contacts"
        description="Shared audience, lists, imports, and consent evidence."
        tabs={CONTACTS_WORKSPACE_TABS}
      />
    );
  }

  if (isInboxWorkspacePath(pathname)) {
    return <InboxWorkspaceTabs />;
  }

  return null;
}
