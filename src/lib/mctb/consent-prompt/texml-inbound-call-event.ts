import "server-only";

/** Real AT&T forward shape observed on platform 571 MCTB TeXML inbound. */
export type MctbConsentTexmlInboundCallEvent = {
  from: string;
  to: string;
  forwardedFrom?: string | null;
  callSid?: string | null;
  callStatus?: string | null;
};

export type MctbConsentTexmlDemoCallDetectResult = {
  ran: boolean;
  demoMode: boolean;
  workspaceId: string;
  skippedReason?: "not_demo_mode";
};

/**
 * Background demo-call detection used by `/api/telnyx/voice/mctb-consent`.
 * Awaitable for scripts/regression tests (route uses fire-and-forget wrapper).
 */
export async function runMctbConsentTexmlDemoCallDetect(
  input: MctbConsentTexmlInboundCallEvent,
): Promise<MctbConsentTexmlDemoCallDetectResult> {
  const { resolveMctbTargetWorkspaceForInboundCall } = await import(
    "@/lib/mctb/onboarding/demo-workspace-target"
  );
  const ownerId =
    process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: input.from,
    businessE164: input.to,
    fallbackWorkspaceId: ownerId,
    forwardedFrom: input.forwardedFrom || null,
  });

  if (!target.demoMode) {
    return {
      ran: false,
      demoMode: false,
      workspaceId: target.workspaceId,
      skippedReason: "not_demo_mode",
    };
  }

  const { recordDemoCallDetected } = await import("@/lib/mctb/onboarding/demo");
  await recordDemoCallDetected({
    workspaceId: target.workspaceId,
    from: input.from,
    to: input.to,
    forwardedFrom: input.forwardedFrom ?? null,
    callSid: input.callSid ?? null,
    callStatus: input.callStatus ?? null,
  });

  return {
    ran: true,
    demoMode: true,
    workspaceId: target.workspaceId,
  };
}
