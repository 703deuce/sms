import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export type MctbRecentActivityItem = {
  id: string;
  at: string;
  title: string;
  subtitle: string;
  href: string;
};

export function buildMctbRecentActivity(data: MctbOverviewPayload): MctbRecentActivityItem[] {
  const items: MctbRecentActivityItem[] = [];
  for (const row of data.recentMissedCalls) {
    items.push({
      id: `mc-${row.id}`,
      at: row.missedAt,
      title: `Missed call from ${row.callerLabel}`,
      subtitle: row.recoveryLabel,
      href: MCTB_ROUTES.missedCallDetail(row.id),
    });
  }
  for (const c of data.recentConversations) {
    items.push({
      id: `conv-${c.id}`,
      at: c.updatedAt,
      title: c.needsReply ? `Reply from ${c.label}` : `Conversation with ${c.label}`,
      subtitle: c.preview,
      href: `${MCTB_ROUTES.conversations}?conversation=${encodeURIComponent(c.id)}`,
    });
  }
  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);
}
