"use client";

import { CallHandlingDashboardCard } from "@/components/call-handling/call-handling-switcher";

/** Voice Agent page — canonical PR #483 call handling only (shared dashboard card). */
export function CallHandlingModeSwitch(_props: {
  voiceAgentId?: string | null;
  agentReady?: boolean;
}) {
  return (
    <CallHandlingDashboardCard className="!mx-0 !max-w-none" />
  );
}
