import { BillingSettingsConnected } from "@/features/settings/kimi/billing/billing-connected";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { MctbBillingSettingsOpus } from "@/newui-transplant/connected/settings/mctb-billing-settings-opus";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { workspaceHasAppointmentReminders } from "@/lib/appointment-reminders/entitlement";
import { AR_ROUTES } from "@/lib/appointment-reminders/routes";
import { isAppointmentRemindersV1Primary } from "@/lib/workspace/platform-launch";
import { redirect } from "next/navigation";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const session = await getSession();
  if (session && isAppointmentRemindersV1Primary()) {
    const workspaceId = await getActiveWorkspaceId();
    const hasAr = await workspaceHasAppointmentReminders(workspaceId, {
      isPlatformAdmin: session.isAdmin,
    });
    if (hasAr) {
      redirect(AR_ROUTES.settingsBilling);
    }
  }

  const { upgrade } = await searchParams;
  if (isNewUiStage2Enabled()) {
    return <MctbBillingSettingsOpus highlightProduct={upgrade ?? null} />;
  }

  const body = <BillingSettingsConnected highlightProduct={upgrade ?? null} hideChrome={false} />;

  return <div className="kimi-surface kimi-settings-billing">{body}</div>;
}
