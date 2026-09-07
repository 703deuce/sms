"use client";

import "@/components/appointments/kimi-ui/public-waitlist-accept/reference.css";
import { PublicWaitlistAcceptClient } from "@/components/appointments/kimi-ui/public-waitlist-accept/components/PublicWaitlistAcceptClient";

export function PublicWaitlistAcceptConnected({ token }: { token: string }) {
  return <PublicWaitlistAcceptClient token={token} live />;
}
