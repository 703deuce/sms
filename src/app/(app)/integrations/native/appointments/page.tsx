import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeAppointmentsOpus } from "@/newui-transplant/connected/integrations/native-appointments-opus";
import { AppointmentsClient } from "./appointments-client";

export default function NativeAppointmentsPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeAppointmentsOpus />;
  }
  return <AppointmentsClient />;
}
