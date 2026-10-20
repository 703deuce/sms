import { displayE164ForDestination, type ForwardingDestinationRow } from "./resolve-destination";

export function toForwardingDestinationDto(
  row: ForwardingDestinationRow & {
    workspacePhoneNumber?: { e164: string; friendlyName: string | null } | null;
  },
) {
  const displayNumber =
    row.destinationKind === "workspace_number"
      ? row.workspacePhoneNumber?.e164 || row.phoneE164 || ""
      : row.phoneE164 || "";
  return {
    id: row.id,
    name: row.name,
    destinationKind: row.destinationKind,
    phoneE164: displayE164ForDestination(row),
    workspacePhoneNumberId: row.workspacePhoneNumberId,
    workspaceNumberLabel: row.workspacePhoneNumber?.friendlyName ?? null,
    enabled: row.enabled,
    press1Required: row.press1Required,
    screeningEnabled: row.screeningEnabled,
    ringTimeoutSec: row.ringTimeoutSec,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    displayNumber,
  };
}
