import { BillingSettingsConnected } from "@/features/settings/kimi/billing/billing-connected";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  return (
    <div className="kimi-surface kimi-settings-billing">
      <BillingSettingsConnected highlightProduct={upgrade ?? null} />
    </div>
  );
}
