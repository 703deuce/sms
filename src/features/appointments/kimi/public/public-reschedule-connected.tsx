"use client";

import { PublicRescheduleOpusPage } from "@/newui-transplant/connected/appointments/public-reschedule-opus-page";

export function PublicRescheduleConnected({ token }: { token: string }) {
  return <PublicRescheduleOpusPage token={token} />;
}
