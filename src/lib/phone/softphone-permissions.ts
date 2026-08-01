/**
 * Softphone permission checks — workspace role + per-user SoftphoneUserSettings.permissionsJson.
 */

import { getPrisma } from "@/lib/db";
import { getMembershipRole } from "@/lib/voice/permissions";

export type SoftphonePermission =
  | "place_call"
  | "record"
  | "transfer"
  | "international"
  | "whisper"
  | "listen"
  | "admin_settings"
  | "block_caller"
  | "anonymous_dial";

type PermissionsJson = Partial<Record<SoftphonePermission, boolean>> & {
  canRecord?: boolean;
  canTransfer?: boolean;
  canInternational?: boolean;
  canWhisper?: boolean;
};

const ROLE_DEFAULTS: Record<string, SoftphonePermission[]> = {
  OWNER: [
    "place_call",
    "record",
    "transfer",
    "international",
    "whisper",
    "listen",
    "admin_settings",
    "block_caller",
    "anonymous_dial",
  ],
  ADMINISTRATOR: [
    "place_call",
    "record",
    "transfer",
    "international",
    "whisper",
    "listen",
    "admin_settings",
    "block_caller",
    "anonymous_dial",
  ],
  MANAGER: [
    "place_call",
    "record",
    "transfer",
    "international",
    "whisper",
    "listen",
    "block_caller",
    "anonymous_dial",
  ],
  CAMPAIGN_CREATOR: ["place_call", "record", "transfer"],
  INBOX_AGENT: ["place_call", "record", "transfer"],
  ANALYST: ["listen"],
  READ_ONLY: [],
};

function legacyMap(perms: PermissionsJson): SoftphonePermission[] {
  const out: SoftphonePermission[] = ["place_call"];
  if (perms.record !== false && perms.canRecord !== false) out.push("record");
  if (perms.transfer !== false && perms.canTransfer !== false) out.push("transfer");
  if (perms.international || perms.canInternational) out.push("international");
  if (perms.whisper || perms.canWhisper) out.push("whisper");
  if (perms.listen) out.push("listen");
  if (perms.admin_settings) out.push("admin_settings");
  if (perms.block_caller !== false) out.push("block_caller");
  if (perms.anonymous_dial) out.push("anonymous_dial");
  return out;
}

export async function getSoftphonePermissions(workspaceId: string, userId: string) {
  const role = await getMembershipRole(userId, workspaceId);
  const roleAllowed = new Set(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.READ_ONLY);

  const settings = await getPrisma().softphoneUserSettings.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  const perms = (settings?.permissionsJson || {}) as PermissionsJson;
  const hasExplicit = Boolean(settings?.permissionsJson) && Object.keys(perms).length > 0;
  const allowed = hasExplicit ? new Set(legacyMap(perms)) : roleAllowed;

  // Hard flags on settings override JSON for common dial/record/intl controls.
  if (settings?.recordingEnabled === false) allowed.delete("record");
  if (settings?.internationalEnabled === false) allowed.delete("international");
  if (settings?.internationalEnabled === true) allowed.add("international");

  return { role, allowed, settings };
}

export async function requireSoftphonePermission(
  workspaceId: string,
  userId: string,
  permission: SoftphonePermission,
) {
  const { role, allowed } = await getSoftphonePermissions(workspaceId, userId);
  if (!allowed.has(permission)) {
    throw new Error(`Forbidden: ${permission} not allowed for role ${role}`);
  }
}

export async function requireWorkspacePhoneAdmin(workspaceId: string, userId: string) {
  await requireSoftphonePermission(workspaceId, userId, "admin_settings");
}
