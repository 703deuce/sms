"use client";

import "@/components/appointments/kimi-ui/public-confirm/reference.css";
import { PublicActionClient } from "@/components/appointments/kimi-ui/public-confirm/components/public-action-client";

export function PublicConfirmConnected({ token }: { token: string }) {
  return <PublicActionClient kind="confirm" token={token} live />;
}
