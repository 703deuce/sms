import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { CrmProviderOpus } from "@/newui-transplant/connected/integrations/crm-provider-opus";
import { CrmProviderClient } from "./crm-provider-client";

export default async function CrmProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  if (isNewUiStage2Enabled()) {
    return <CrmProviderOpus provider={provider} />;
  }
  return <CrmProviderClient provider={provider} />;
}
