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
  | "anonymous_dial"
  | "park"
  | "conference"
  | "flip"
  | "merge";

type PermissionsJson = Partial<Record<SoftphonePermission, boolean>> & {
  canRecord?: boolean;
  canTransfer?: boolean;
  canInternational?: boolean;
  canWhisper?: boolean;
  screening?: boolean;
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
    "park",
    "conference",
    "flip",
    "merge",
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
    "park",
    "conference",
    "flip",
    "merge",
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
    "park",
    "conference",
    "flip",
    "merge",
  ],
  CAMPAIGN_CREATOR: ["place_call", "record", "transfer", "park"],
  INBOX_AGENT: [
    "place_call",
    "record",
    "transfer",
    "block_caller",
    "park",
    "conference",
    "flip",
    "merge",
  ],
  ANALYST: ["listen"],
  READ_ONLY: [],
};

const ACL_KEYS: SoftphonePermission[] = [
  "place_call",
  "record",
  "transfer",
  "international",
  "whisper",
  "listen",
  "admin_settings",
  "block_caller",
  "anonymous_dial",
  "park",
  "conference",
  "flip",
  "merge",
];

function applyExplicitOverrides(
  base: Set<SoftphonePermission>,
  perms: PermissionsJson,
): Set<SoftphonePermission> {
  const out = new Set(base);
  const legacy: Partial<Record<SoftphonePermission, boolean | undefined>> = {
    record: perms.record ?? perms.canRecord,
    transfer: perms.transfer ?? perms.canTransfer,
    international: perms.international ?? perms.canInternational,
    whisper: perms.whisper ?? perms.canWhisper,
    place_call: perms.place_call,
    listen: perms.listen,
    admin_settings: perms.admin_settings,
    block_caller: perms.block_caller,
    anonymous_dial: perms.anonymous_dial,
    park: perms.park,
    conference: perms.conference,
    flip: perms.flip,
    merge: perms.merge,
  };
  for (const key of ACL_KEYS) {
    const val = legacy[key];
    if (val === true) out.add(key);
    if (val === false) out.delete(key);
  }
  return out;
}

export async function getSoftphonePermissions(workspaceId: string, userId: string) {
  const role = await getMembershipRole(userId, workspaceId);
  const roleAllowed = new Set(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.READ_ONLY);

  const settings = await getPrisma().softphoneUserSettings.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  const perms = (settings?.permissionsJson || {}) as PermissionsJson;
  const hasAclKeys = ACL_KEYS.some((k) => typeof (perms as Record<string, unknown>)[k] === "boolean")
    || typeof perms.canRecord === "boolean"
    || typeof perms.canTransfer === "boolean"
    || typeof perms.canInternational === "boolean"
    || typeof perms.canWhisper === "boolean";

  const allowed = hasAclKeys ? applyExplicitOverrides(roleAllowed, perms) : roleAllowed;

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
