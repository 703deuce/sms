import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { CrmPipelineOpus } from "@/newui-transplant/connected/integrations/crm-pipeline-opus";
import { PipelineClient } from "./pipeline-client";

export default function CrmPipelinePage() {
  if (isNewUiStage2Enabled()) {
    return <CrmPipelineOpus />;
  }
  return <PipelineClient />;
}
