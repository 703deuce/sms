import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveVerifiedBusinessCallerId, loadSmartRoutingWorkspaceSettings } from "./workspace-settings";

export type ApprovedCallerIdentity = {
  e164: string;
  label: string;
  verified: boolean;
  provider?: string | null;
  callerNameStatus?: "registered" | "pending" | "not_configured";
};

/** List verified outbound identities for a workspace. */
export async function listApprovedCallerIdentities(workspaceId: string): Promise<ApprovedCallerIdentity[]> {
  const settings = await loadSmartRoutingWorkspaceSettings(workspaceId);
  const identities: ApprovedCallerIdentity[] = [];
  const seen = new Set<string>();

  const add = (e164: string | null | undefined, label: string) => {
    if (!e164?.trim()) return;
    try {
      const normalized = normalizeE164(e164);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      identities.push({
        e164: normalized,
        label,
        verified: settings?.callerIdStatus === "verified",
        provider: settings?.callerIdProvider ?? "telnyx",
        callerNameStatus:
          settings?.callerIdStatus === "verified" ? "registered" : "not_configured",
      });
    } catch {
      // skip invalid
    }
  };

  add(settings?.publicBusinessE164, "Main business line");
  add(settings?.routingNumberE164, "Routing number");

  const numbers = await getPrisma().phoneNumber.findMany({
    where: { workspaceId, status: "active" },
    select: { e164: true, friendlyName: true },
    take: 20,
  });
  for (const n of numbers) {
    add(n.e164, n.friendlyName?.trim() || "Business number");
  }

  return identities;
}

/** Default caller ID for callback — prefer number the customer originally called. */
export async function resolveCallbackCallerIdE164(input: {
  workspaceId: string;
  originalInboundSessionId?: string | null;
  authorizedCallerDefaultE164?: string | null;
}): Promise<string | null> {
  const approved = await listApprovedCallerIdentities(input.workspaceId);
  const approvedSet = new Set(approved.map((a) => a.e164));

  if (input.originalInboundSessionId) {
    const session = await getPrisma().smartRoutingCallSession.findFirst({
      where: { id: input.originalInboundSessionId, workspaceId: input.workspaceId },
      select: { calledNumber: true },
    });
    if (session?.calledNumber) {
      try {
        const called = normalizeE164(session.calledNumber);
        if (approvedSet.has(called)) return called;
      } catch {
        // fall through
      }
    }
  }

  if (input.authorizedCallerDefaultE164) {
    try {
      const def = normalizeE164(input.authorizedCallerDefaultE164);
      if (approvedSet.has(def)) return def;
    } catch {
      // fall through
    }
  }

  return await resolveVerifiedBusinessCallerId(input.workspaceId);
}
