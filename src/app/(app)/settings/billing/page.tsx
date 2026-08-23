import { BillingSettingsPanel } from "@/components/settings/billing-settings-panel";

export default async function SettingsBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>;
}) {
  const { upgrade } = await searchParams;
  return <BillingSettingsPanel highlightProduct={upgrade ?? null} />;
}
