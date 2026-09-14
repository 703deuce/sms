/**
 * MCTB exists for after-hours missed calls — inbox "away / outside business hours"
 * auto-replies (mass-texting / conversations settings) must never answer on MCTB DIDs.
 */
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  isMctbSipIngressTargetSync,
  isPhoneMctbSipIngress,
} from "@/lib/mctb/sip-ingress/sync";
import { isMctbCustomerReplyThread } from "@/lib/agents/missed-call-text-back/customer-sms";

export async function shouldSkipInboxAwayAutoReply(input: {
  workspaceId: string;
  fromE164: string;
  toE164?: string | null;
}): Promise<boolean> {
  const to = input.toE164 ? normalizeE164(input.toE164) || input.toE164 : null;
  if (to && isMctbSipIngressTargetSync(to)) {
    return true;
  }

  if (to) {
    const prisma = getPrisma();
    const digits = to.replace(/\D/g, "");
    const phone = await prisma.phoneNumber.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: "Active",
        OR: [{ e164: to }, ...(digits ? [{ e164: digits }] : [])],
      },
      select: { settingsJson: true },
    });
    if (phone && isPhoneMctbSipIngress(phone.settingsJson)) {
      return true;
    }
  }

  return isMctbCustomerReplyThread(input.workspaceId, input.fromE164);
}
