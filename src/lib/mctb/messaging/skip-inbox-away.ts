/**
 * MCTB exists for after-hours missed calls — inbox "away / outside business hours"
 * auto-replies (mass-texting / conversations settings) must never answer on MCTB DIDs.
 */
import { getPrisma } from "@/lib/db";
import {
  isMctbSipIngressTargetSync,
  isPhoneMctbSipIngress,
} from "@/lib/mctb/sip-ingress/sync";
import { isMctbCustomerReplyThread } from "@/lib/agents/missed-call-text-back/customer-sms";
import { readPhoneProductRoles } from "@/lib/mass-texting/product-source";
import { mctbDidE164Variants } from "@/lib/mctb/messaging/caller-e164";

export async function shouldSkipInboxAwayAutoReply(input: {
  workspaceId: string;
  fromE164: string;
  toE164?: string | null;
}): Promise<boolean> {
  const toVariants = input.toE164 ? mctbDidE164Variants(input.toE164) : [];
  const to = toVariants[0] ?? null;
  if (to && isMctbSipIngressTargetSync(to)) {
    return true;
  }

  if (toVariants.length) {
    const prisma = getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: "Active",
        e164: { in: toVariants },
      },
      select: { settingsJson: true },
    });
    if (phone) {
      if (isPhoneMctbSipIngress(phone.settingsJson)) return true;
      if (readPhoneProductRoles(phone.settingsJson).mctb) return true;
    }
  }

  return isMctbCustomerReplyThread(input.workspaceId, input.fromE164);
}
