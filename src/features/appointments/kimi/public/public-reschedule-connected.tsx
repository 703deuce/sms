"use client";

import "@/components/appointments/kimi-ui/public-reschedule/reference.css";
import { RescheduleFlow } from "@/components/appointments/kimi-ui/public-reschedule/components/RescheduleFlow";

export function PublicRescheduleConnected({ token }: { token: string }) {
  return <RescheduleFlow token={token} live />;
}
