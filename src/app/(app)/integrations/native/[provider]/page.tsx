import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeProviderOpus } from "@/newui-transplant/connected/integrations/native-provider-opus";
import { NativeProviderClient } from "./native-provider-client";

export default async function NativeProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  if (isNewUiStage2Enabled()) {
    return <NativeProviderOpus provider={provider} />;
  }
  return <NativeProviderClient provider={provider} />;
}
