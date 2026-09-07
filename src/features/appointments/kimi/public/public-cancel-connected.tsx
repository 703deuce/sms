"use client";

import "@/components/appointments/kimi-ui/public-cancel/reference.css";
import { PublicCancelClient } from "@/components/appointments/kimi-ui/public-cancel/components/public-cancel-client";

export function PublicCancelConnected({ token }: { token: string }) {
  return <PublicCancelClient token={token} live />;
}
