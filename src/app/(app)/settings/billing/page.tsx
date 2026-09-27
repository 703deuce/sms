import { BillingSettingsConnected } from "@/features/settings/kimi/billing/billing-connected";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  const body = <BillingSettingsConnected highlightProduct={upgrade ?? null} hideChrome={isNewUiStage2Enabled()} />;

  if (isNewUiStage2Enabled()) {
    return body;
  }

  return <div className="kimi-surface kimi-settings-billing">{body}</div>;
}
