import { BillingSettingsConnected } from "@/features/settings/kimi/billing/billing-connected";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { BillingSettingsOpus } from "@/newui-transplant/connected/settings/billing-settings-opus";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  if (isNewUiStage2Enabled()) {
    return <BillingSettingsOpus highlightProduct={upgrade ?? null} />;
  }

  const body = <BillingSettingsConnected highlightProduct={upgrade ?? null} hideChrome={false} />;

  return <div className="kimi-surface kimi-settings-billing">{body}</div>;
}
