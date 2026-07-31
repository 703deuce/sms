import { getPrisma } from "@/lib/db";

export type VoiceAction =
  | "create_agent"
  | "edit_agent"
  | "publish_agent"
  | "delete_agent"
  | "start_campaign"
  | "purchase_number"
  | "view_recordings"
  | "download_recordings"
  | "view_transcripts"
  | "delete_call_data"
  | "manage_integrations"
  | "manage_billing"
  | "compliance_settings"
  | "place_manual_call"
  | "view_analytics";

const MATRIX: Record<string, VoiceAction[]> = {
  OWNER: [
    "create_agent", "edit_agent", "publish_agent", "delete_agent", "start_campaign",
    "purchase_number", "view_recordings", "download_recordings", "view_transcripts",
    "delete_call_data", "manage_integrations", "manage_billing", "compliance_settings",
    "place_manual_call", "view_analytics",
  ],
  ADMINISTRATOR: [
    "create_agent", "edit_agent", "publish_agent", "delete_agent", "start_campaign",
    "purchase_number", "view_recordings", "download_recordings", "view_transcripts",
    "delete_call_data", "manage_integrations", "compliance_settings", "place_manual_call",
    "view_analytics",
  ],
  MANAGER: [
    "create_agent", "edit_agent", "publish_agent", "start_campaign", "view_recordings",
    "view_transcripts", "place_manual_call", "view_analytics",
  ],
  CAMPAIGN_CREATOR: [
    "create_agent", "edit_agent", "start_campaign", "place_manual_call", "view_analytics",
    "view_transcripts",
  ],
  INBOX_AGENT: ["place_manual_call", "view_transcripts", "view_recordings"],
  ANALYST: ["view_analytics", "view_transcripts", "view_recordings", "download_recordings"],
  READ_ONLY: ["view_analytics", "view_transcripts"],
};

export async function getMembershipRole(userId: string, workspaceId: string) {
  const m = await getPrisma().membership.findFirst({
    where: { userId, workspaceId },
  });
  return m?.role || "READ_ONLY";
}

export function canVoiceAction(role: string, action: VoiceAction): boolean {
  const allowed = MATRIX[role] || MATRIX.READ_ONLY;
  return allowed.includes(action);
}

export async function requireVoicePermission(
  userId: string,
  workspaceId: string,
  action: VoiceAction,
) {
  const role = await getMembershipRole(userId, workspaceId);
  if (!canVoiceAction(role, action)) {
    throw new Error(`Forbidden: ${action} not allowed for role ${role}`);
  }
  return role;
}
