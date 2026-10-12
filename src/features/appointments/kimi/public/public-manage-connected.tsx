"use client";

import "@/components/appointments/kimi-ui/public-reschedule/reference.css";
import { ManageAppointmentFlow } from "@/components/appointments/kimi-ui/public-manage/components/ManageAppointmentFlow";

export function PublicManageConnected({ token }: { token: string }) {
  return <ManageAppointmentFlow token={token} live />;
}
