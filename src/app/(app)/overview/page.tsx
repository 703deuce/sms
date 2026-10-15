import { UnifiedOverviewPage } from "@/newui-transplant/connected/business-messaging/unified-overview-page";
import { loadMctbOverviewCore } from "@/lib/mctb/overview";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { workspaceHasAppointmentReminders } from "@/lib/appointment-reminders/entitlement";
import { getSession } from "@/lib/auth";
import {
  isAppointmentRemindersInBusinessMessagingSidebar,
  isMassSmsInBusinessMessagingSidebar,
} from "@/lib/workspace/platform-launch";

export default async function BusinessMessagingOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const session = await getSession();
  const productFeatures = await getWorkspaceProductFeatures(workspaceId, {
    isPlatformAdmin: session?.isAdmin,
  });

  const hasMctb = isActiveEntitlement(productFeatures.mctb);
  const hasMassSms = isActiveEntitlement(productFeatures.mass_texting);
  const hasAppointmentReminders = await workspaceHasAppointmentReminders(workspaceId, {
    isPlatformAdmin: session?.isAdmin,
  });

  const mctbData = hasMctb ? await loadMctbOverviewCore(workspaceId) : null;

  const showArOnOverview =
    hasAppointmentReminders && isAppointmentRemindersInBusinessMessagingSidebar();
  const showMassOnOverview = hasMassSms && isMassSmsInBusinessMessagingSidebar();

  return (
    <UnifiedOverviewPage
      services={{
        hasMctb,
        hasAppointmentReminders: showArOnOverview,
        hasMassSms: showMassOnOverview,
      }}
      mctbData={mctbData}
    />
  );
}
