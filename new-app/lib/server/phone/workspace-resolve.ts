import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { maskE164, phoneServerLog } from "@/lib/server/phone/phone-log";

function isPhoneNumberRoutingCandidate(raw: string): boolean {
  const t = raw.trim();
  if (!t || /^sip:/i.test(t)) return false;
  return /^\+?\d/.test(t);
}

/** Resolve tenant from the called number (authoritative for inbound PSTN webhooks). */
export async function resolveWorkspaceByInboundNumber(toE164: string): Promise<string | null> {
  if (!isPhoneNumberRoutingCandidate(toE164)) return null;
  const prisma = getPrisma();
  let normalized: string;
  try {
    normalized = normalizeE164(toE164);
  } catch {
    return null;
  }
  const pn = await prisma.phoneNumber.findFirst({
    where: {
      OR: [{ e164: toE164 }, { e164: normalized }],
      status: "Active",
    },
    select: { workspaceId: true },
    orderBy: { purchasedAt: "asc" },
  });
  return pn?.workspaceId ?? null;
}

export async function resolveWorkspaceForPhoneEvent(toE164?: string | null): Promise<string> {
  if (toE164?.trim()) {
    const fromNumber = await resolveWorkspaceByInboundNumber(toE164);
    if (fromNumber) {
      phoneServerLog("workspace-resolve", "from_called_number", {
        to: maskE164(toE164),
        workspaceId: fromNumber,
      });
      return fromNumber;
    }
    phoneServerLog("workspace-resolve", "number_not_in_db_fallback_default", {
      to: maskE164(toE164),
    });
  } else {
    phoneServerLog("workspace-resolve", "no_to_on_event_fallback_default");
  }
  const fallback = await resolveWorkspaceId();
  phoneServerLog("workspace-resolve", "using_default_workspace", { workspaceId: fallback });
  return fallback;
}
