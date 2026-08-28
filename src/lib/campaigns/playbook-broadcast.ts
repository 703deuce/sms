import {
  DEFAULT_MESSAGES,
  getCampaignCategory,
  type CampaignCategoryId,
} from "./catalog";

const BROADCAST_PLAYBOOK_NAMES: Partial<Record<CampaignCategoryId, string>> = {
  broadcast: "New announcement",
  promotion: "New promotion",
};

/** Seed broadcast composer when opened from /playbooks (engine: broadcast). */
export function seedBroadcastComposeFromPlaybook(
  playbookId: string | null,
  draft: { name: string; message: string },
): { name: string; message: string } {
  if (!playbookId) return draft;
  const category = getCampaignCategory(playbookId);
  if (!category || category.engine !== "broadcast") return draft;

  const id = category.id as CampaignCategoryId;
  return {
    name: draft.name.trim() || BROADCAST_PLAYBOOK_NAMES[id] || category.title,
    message: draft.message.trim() || DEFAULT_MESSAGES[id] || draft.message,
  };
}
