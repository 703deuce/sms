"use client";

import { PublicManageOpusPage } from "@/newui-transplant/connected/appointments/public-manage-opus-page";

export function PublicManageConnected({ token }: { token: string }) {
  return <PublicManageOpusPage token={token} />;
}
