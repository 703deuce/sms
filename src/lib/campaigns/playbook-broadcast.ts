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
  opts?: { force?: boolean },
): { name: string; message: string; categoryId: CampaignCategoryId | null } {
  if (!playbookId) {
    return { name: draft.name, message: draft.message, categoryId: null };
  }
  const category = getCampaignCategory(playbookId);
  if (!category || category.engine !== "broadcast") {
    return { name: draft.name, message: draft.message, categoryId: null };
  }

  const id = category.id as CampaignCategoryId;
  const defaultName = BROADCAST_PLAYBOOK_NAMES[id] || category.title;
  const defaultMessage = DEFAULT_MESSAGES[id] || draft.message;
  const force = opts?.force === true;
  return {
    name: force || !draft.name.trim() ? defaultName : draft.name,
    message: force || !draft.message.trim() ? defaultMessage : draft.message,
    categoryId: id,
  };
}
