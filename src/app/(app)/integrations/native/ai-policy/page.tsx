import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeAiPolicyOpus } from "@/newui-transplant/connected/integrations/native-ai-policy-opus";
import { AiPolicyClient } from "./ai-policy-client";

export default function NativeAiPolicyPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeAiPolicyOpus />;
  }
  return <AiPolicyClient />;
}
