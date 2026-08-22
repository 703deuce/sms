/**
 * Route inbound SMS on shared/platform numbers to the correct customer workspace.
 * Uses recent outbound message correlation — not hard-coded overrides.
 */
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isPlatformDemoPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";
import { resolveDemoWorkspaceForCaller } from "@/lib/mctb/onboarding/demo";

const RECENT_OUTBOUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function normalizePair(from: string, to: string): { from: string; to: string } {
  try {
    return { from: normalizeE164(from), to: normalizeE164(to) };
  } catch {
    return { from, to };
  }
}

/** Find customer workspace for an inbound reply based on recent outbound from the same DID pair. */
export async function resolveInboundWorkspaceByRecentOutbound(input: {
  fromE164: string;
  toE164: string;
  platformOwnerWorkspaceId?: string | null;
}): Promise<string | null> {
  const { from, to } = normalizePair(input.fromE164, input.toE164);
  const since = new Date(Date.now() - RECENT_OUTBOUND_WINDOW_MS);
  const prisma = getPrisma();

  const recent = await prisma.message.findFirst({
    where: {
      to: from,
      from: to,
      createdAt: { gte: since },
      status: { in: ["sending", "sent", "delivered", "queued"] },
      ...(input.platformOwnerWorkspaceId
        ? { workspaceId: { not: input.platformOwnerWorkspaceId } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { workspaceId: true },
  });
  if (recent?.workspaceId) return recent.workspaceId;

  const mctbEvent = await prisma.missedCallEvent.findFirst({
    where: {
      callerE164: from,
      businessE164: { not: to },
      smsSentAt: { gte: since },
      status: "SENT",
      ...(input.platformOwnerWorkspaceId
        ? { workspaceId: { not: input.platformOwnerWorkspaceId } }
        : {}),
    },
    orderBy: { smsSentAt: "desc" },
    select: { workspaceId: true },
  });
  return mctbEvent?.workspaceId || null;
}

/**
 * Resolve workspace for inbound SMS to a platform/shared Telnyx line.
 * Demo sessions take priority; otherwise correlate via recent outbound.
 */
export async function resolveMctbInboundWorkspace(input: {
  fromE164: string;
  toE164: string;
  phoneRecord?: { workspaceId: string; e164: string; settingsJson?: unknown } | null;
}): Promise<{ workspaceId: string; reason: "demo_session" | "recent_outbound" | "phone_owner" } | null> {
  const demo = await resolveDemoWorkspaceForCaller(input.fromE164);
  if (demo) {
    return { workspaceId: demo.workspaceId, reason: "demo_session" };
  }

  const isPlatform =
    input.phoneRecord &&
    isPlatformDemoPhoneRecord({
      e164: input.phoneRecord.e164,
      settingsJson: input.phoneRecord.settingsJson,
    });

  if (isPlatform || input.phoneRecord) {
    const correlated = await resolveInboundWorkspaceByRecentOutbound({
      fromE164: input.fromE164,
      toE164: input.toE164,
      platformOwnerWorkspaceId: input.phoneRecord?.workspaceId,
    });
    if (correlated) {
      return { workspaceId: correlated, reason: "recent_outbound" };
    }
  }

  if (input.phoneRecord?.workspaceId) {
    return { workspaceId: input.phoneRecord.workspaceId, reason: "phone_owner" };
  }

  return null;
}
