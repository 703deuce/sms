import "server-only";

import { getPrisma } from "@/lib/db";
import { mctbCallerE164Variants } from "@/lib/mctb/messaging/caller-e164";
import type { MctbOutboundSmsRoute } from "@/lib/mctb/messaging/outbound-sms-route";

/** Appended once per consumer thread on Transovo platform sender (TFV / carrier disclosure). */
export const PLATFORM_SENDER_FIRST_MESSAGE_DISCLOSURE =
  " Reply STOP to opt out. Reply HELP for help. Msg&data rates may apply.";

const VIA_TRANSOVO_TAG = "via Transovo";

export function messageAlreadyHasPlatformDisclosure(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  return /via\s+transovo/i.test(t) && /\bSTOP\b/i.test(t);
}

export function applyPlatformSenderFirstMessageDisclosure(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return trimmed;
  if (messageAlreadyHasPlatformDisclosure(trimmed)) return trimmed;
  const withBrand = /via\s+transovo/i.test(trimmed)
    ? trimmed
    : `${trimmed}\n\n— ${VIA_TRANSOVO_TAG}.`;
  return `${withBrand}${PLATFORM_SENDER_FIRST_MESSAGE_DISCLOSURE}`;
}

export async function consumerHasPriorMctbOutboundSms(input: {
  workspaceId: string;
  consumerE164: string;
  conversationId?: string | null;
}): Promise<boolean> {
  const prisma = getPrisma();
  const variants = mctbCallerE164Variants(input.consumerE164);

  if (input.conversationId) {
    const prior = await prisma.conversationMessage.findFirst({
      where: { conversationId: input.conversationId, direction: "outbound" },
      select: { id: true },
    });
    if (prior) return true;
  }

  const priorMissed = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerE164: { in: variants },
      smsSentAt: { not: null },
    },
    select: { id: true },
  });
  return Boolean(priorMissed);
}

export async function finalizeMctbPlatformConsumerSmsBody(input: {
  workspaceId: string;
  consumerE164: string;
  body: string;
  route: MctbOutboundSmsRoute;
  conversationId?: string | null;
  /** Recovery opener and other guaranteed-first sends */
  treatAsFirstMessage?: boolean;
}): Promise<string> {
  if (input.route.senderMode !== "PLATFORM") return input.body.trim();
  const needsDisclosure =
    input.treatAsFirstMessage === true
      ? true
      : !(await consumerHasPriorMctbOutboundSms({
          workspaceId: input.workspaceId,
          consumerE164: input.consumerE164,
          conversationId: input.conversationId,
        }));
  if (!needsDisclosure) return input.body.trim();
  return applyPlatformSenderFirstMessageDisclosure(input.body);
}
