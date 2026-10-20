import type { VoiceV3TransferPolicyCompiled } from "./types";

export type TransferPublishIssue = { id: string; message: string };

export function validateVoiceV3TransferPolicyForPublish(
  policy: VoiceV3TransferPolicyCompiled | null | undefined,
  transferCapabilityEnabled: boolean,
): TransferPublishIssue[] {
  if (!transferCapabilityEnabled) return [];
  if (!policy?.enabled) {
    return [
      {
        id: "transfer_disabled",
        message: "Transfer calls capability is on but no valid transfer destinations are configured.",
      },
    ];
  }
  const issues: TransferPublishIssue[] = [];
  if (!policy.destinations.length) {
    issues.push({ id: "transfer_no_destinations", message: "Add at least one transfer destination." });
  }
  if (!policy.routes.length) {
    issues.push({ id: "transfer_no_routes", message: "Configure a transfer route with at least one target." });
  }
  for (const route of policy.routes) {
    if (!route.targets.length) {
      issues.push({
        id: `transfer_empty_route_${route.id}`,
        message: `Transfer route "${route.label}" has no targets.`,
      });
    }
    for (const t of route.targets) {
      const dest = policy.destinations.find((d) => d.id === t.destinationId);
      if (!dest) {
        issues.push({
          id: `transfer_missing_dest_${t.destinationId}`,
          message: `Transfer route references unknown destination "${t.destinationId}".`,
        });
      } else if (!dest.phoneE164) {
        issues.push({
          id: `transfer_bad_phone_${dest.id}`,
          message: `Destination "${dest.label}" needs a valid E.164 phone number.`,
        });
      }
      if (t.ringingTimeoutSeconds < 5 || t.ringingTimeoutSeconds > 120) {
        issues.push({
          id: `transfer_bad_timeout_${t.destinationId}`,
          message: `Ringing timeout for "${dest?.label ?? t.destinationId}" must be between 5 and 120 seconds.`,
        });
      }
      if (t.mode === "WARM" && !policy.telephony.outboundSipTrunkId) {
        issues.push({
          id: "transfer_warm_no_trunk",
          message:
            "Warm transfer requires a configured LiveKit outbound SIP trunk (LIVEKIT_SIP_OUTBOUND_TRUNK or platform trunk id).",
        });
      }
    }
  }
  return issues;
}
