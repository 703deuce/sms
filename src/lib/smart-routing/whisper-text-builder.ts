import "server-only";

import { getPrisma } from "@/lib/db";
import { fmtPhoneDisplay } from "./display";

export async function buildRichWhisperText(input: {
  workspaceId: string;
  sessionId: string;
  callerE164: string;
  routeLabel?: string | null;
  destinationWhisperLabel?: string | null;
  acceptDigit?: string;
}): Promise<string> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true, displayName: true },
  });
  const session = await prisma.smartRoutingCallSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    select: { calledNumber: true, menuSelection: true },
  });

  const business = workspace?.displayName?.trim() || workspace?.name?.trim() || "your business";
  const caller = fmtPhoneDisplay(input.callerE164);
  const route =
    input.routeLabel?.trim() ||
    (session?.menuSelection ? `menu option ${session.menuSelection}` : "main line");
  const digit = input.acceptDigit ?? "1";

  if (input.destinationWhisperLabel?.trim()) {
    return `${input.destinationWhisperLabel.trim()} Press ${digit} to accept.`;
  }

  return `${business} call from ${caller} on ${route}. Press ${digit} to accept.`;
}
