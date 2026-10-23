import { resolveContactDialPhone } from "./phone-resolve";
import type { ContactForEligibility, PowerDialerCampaignRules } from "./types";
import { isOnInternalDnc } from "./internal-dnc";
import { getPowerDialerUsageSnapshot } from "./usage-limits";

export async function flagsForContactEligibility(
  workspaceId: string,
  contact: ContactForEligibility,
  rules: PowerDialerCampaignRules,
) {
  const { e164 } = resolveContactDialPhone(contact, rules.phoneFieldPriority);
  const [onInternalDnc, usage] = await Promise.all([
    e164 ? isOnInternalDnc(workspaceId, e164) : Promise.resolve(false),
    getPowerDialerUsageSnapshot(workspaceId),
  ]);
  return { onInternalDnc, usageBlocked: usage.blocked };
}
