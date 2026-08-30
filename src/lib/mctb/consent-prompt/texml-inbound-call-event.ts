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
  workspaceId: string | null;
  skippedReason?: "not_demo_mode" | "workspace_unresolved";
};

/**
 * Background demo-call detection used by `/api/telnyx/voice/mctb-consent`.
 * Awaitable for scripts/regression tests (route uses fire-and-forget wrapper).
 */
export async function runMctbConsentTexmlDemoCallDetect(
  input: MctbConsentTexmlInboundCallEvent,
): Promise<MctbConsentTexmlDemoCallDetectResult> {
  const { resolveMctbTexmlIngressConfig } = await import(
    "@/lib/mctb/texml-ingress/config-cache"
  );
  const ingress = await resolveMctbTexmlIngressConfig(input.to).catch(() => null);
  if (!ingress?.workspaceId) {
    return {
      ran: false,
      demoMode: false,
      workspaceId: null,
      skippedReason: "workspace_unresolved",
    };
  }

  const { resolveMctbTargetWorkspaceForInboundCall } = await import(
    "@/lib/mctb/onboarding/demo-workspace-target"
  );
  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: input.from,
    businessE164: input.to,
    forwardedFrom: input.forwardedFrom || null,
  });

  const workspaceId = target.workspaceId || ingress.workspaceId;
  if (!workspaceId) {
    return {
      ran: false,
      demoMode: false,
      workspaceId: null,
      skippedReason: "workspace_unresolved",
    };
  }

  if (!target.demoMode) {
    return {
      ran: false,
      demoMode: false,
      workspaceId,
      skippedReason: "not_demo_mode",
    };
  }

  const { recordDemoCallDetected } = await import("@/lib/mctb/onboarding/demo");
  await recordDemoCallDetected({
    workspaceId,
    from: input.from,
    to: input.to,
    forwardedFrom: input.forwardedFrom ?? null,
    callSid: input.callSid ?? null,
    callStatus: input.callStatus ?? null,
  });

  return {
    ran: true,
    demoMode: true,
    workspaceId,
  };
}
