import type { CampaignAdvanced } from "./campaign-advanced";

export type MemberRow = {
  contactId: string;
  createdAt?: Date;
  dialPriority?: number;
  queueSortOrder?: number | null;
  member?: unknown;
};

export function sortCampaignQueueMembers<T extends MemberRow>(
  members: T[],
  advanced: CampaignAdvanced,
): T[] {
  const order = advanced.dialOrder || "fifo";
  const copy = [...members];
  if (order === "priority") {
    copy.sort((a, b) => (b.dialPriority ?? 0) - (a.dialPriority ?? 0));
    return copy;
  }
  if (order === "lifo") {
    copy.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return copy;
  }
  copy.sort((a, b) => {
    if (a.queueSortOrder != null && b.queueSortOrder != null) {
      return a.queueSortOrder - b.queueSortOrder;
    }
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });
  return copy;
}
