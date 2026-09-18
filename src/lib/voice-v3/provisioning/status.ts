/**
 * Provisioning lifecycle — numbers must not show customer-ready until VERIFYING passes.
 */

export const VOICE_NUMBER_PROVISIONING_STATUSES = [
  "PENDING",
  "CONFIGURING",
  "VERIFYING",
  "ACTIVE",
  "FAILED",
] as const;

export type VoiceNumberProvisioningStatus = (typeof VOICE_NUMBER_PROVISIONING_STATUSES)[number];

export function isCustomerReadyProvisioningStatus(
  status: VoiceNumberProvisioningStatus,
): boolean {
  return status === "ACTIVE";
}

export function assertProvisioningTransition(
  from: VoiceNumberProvisioningStatus,
  to: VoiceNumberProvisioningStatus,
): void {
  const order: VoiceNumberProvisioningStatus[] = [
    "PENDING",
    "CONFIGURING",
    "VERIFYING",
    "ACTIVE",
  ];
  if (to === "FAILED") return;
  const fromIdx = order.indexOf(from);
  const toIdx = order.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return;
  if (toIdx < fromIdx) {
    throw new Error(`Invalid provisioning transition ${from} → ${to}`);
  }
}
