import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";

/**
 * Team-facing urgent SMS alerts (business recipients) — not consumer MCTB recovery SMS.
 * Uses authoritative MCTB paid service entitlement until a dedicated SKU flag exists.
 */
export async function canSendMctbUrgentBusinessTeamSms(workspaceId: string): Promise<boolean> {
  return hasActiveMctbPaidEntitlement(workspaceId);
}
