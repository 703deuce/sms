import "server-only";

import { getPrisma } from "@/lib/db";
import { mctbTexmlVoicemailHumanCallId } from "./voicemail-lookup";

/** Hydrate forwarded-from + workspace for TeXML hangup capture (status_callback lacks CFNA headers). */
export async function resolveMctbTexmlCallLegContext(callSid: string): Promise<{
  workspaceId: string;
  forwardedFromE164: string | null;
} | null> {
  const sid = callSid?.trim();
  if (!sid) return null;

  const prisma = getPrisma();
  const humanCallId = mctbTexmlVoicemailHumanCallId(sid);
  const row = await prisma.voicemailMessage.findFirst({
    where: { humanCallId },
    select: { workspaceId: true, forwardedTo: true },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  return {
    workspaceId: row.workspaceId,
    forwardedFromE164: row.forwardedTo?.trim() || null,
  };
}
