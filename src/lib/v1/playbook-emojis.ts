import type { CampaignCategoryId } from "@/lib/campaigns/catalog";

/** Playful emoji accents for playbook cards — V1 polish layer. */
export const PLAYBOOK_EMOJIS: Record<CampaignCategoryId, string> = {
  broadcast: "📣",
  follow_up: "🔁",
  welcome: "👋",
  appointment: "📅",
  missed_call: "📞",
  review: "⭐",
  lead_nurture: "🌱",
  win_back: "💌",
  promotion: "🏷️",
  status_update: "🚚",
  payment: "💳",
  event_rsvp: "🎉",
  data_collection: "📋",
  custom: "⚡",
};

export const ENGINE_LABELS: Record<string, { label: string; emoji: string }> = {
  broadcast: { label: "One-time broadcast", emoji: "📣" },
  sequence: { label: "Multi-step sequence", emoji: "🔁" },
  automation: { label: "Smart automation", emoji: "🤖" },
};
