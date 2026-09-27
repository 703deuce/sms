import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeTasksOpus } from "@/newui-transplant/connected/integrations/native-tasks-opus";
import { TasksClient } from "./tasks-client";

export default function NativeTasksPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeTasksOpus />;
  }
  return <TasksClient />;
}
