import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeAuditOpus } from "@/newui-transplant/connected/integrations/native-audit-opus";
import { AuditClient } from "./audit-client";

export default function NativeAuditPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeAuditOpus />;
  }
  return <AuditClient />;
}
