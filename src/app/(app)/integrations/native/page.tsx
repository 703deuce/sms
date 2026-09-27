import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeIntegrationsOpus } from "@/newui-transplant/connected/integrations/native-integrations-opus";
import { NativeIntegrationsClient } from "./native-integrations-client";

export default function NativeIntegrationsPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeIntegrationsOpus />;
  }
  return <NativeIntegrationsClient />;
}
