import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeLeadsOpus } from "@/newui-transplant/connected/integrations/native-leads-opus";
import { LeadInboxClient } from "./lead-inbox-client";

export default function NativeLeadsPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeLeadsOpus />;
  }
  return <LeadInboxClient />;
}
