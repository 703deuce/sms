import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { CrmIntegrationsOpus } from "@/newui-transplant/connected/integrations/crm-integrations-opus";
import { CrmIntegrationsClient } from "./crm-integrations-client";

export default function CrmIntegrationsPage() {
  if (isNewUiStage2Enabled()) {
    return <CrmIntegrationsOpus />;
  }
  return <CrmIntegrationsClient />;
}
