import "server-only";

import { getPrisma } from "@/lib/db";
import { assertSlotAvailableForBooking } from "@/lib/appointments/slot-validation";
import { rankWaitlistEntries } from "@/lib/appointments/service-booking/phase2/waitlist-priority";
import {
  entryMatchesWaitlistSlotPreferences,
  type CalendarOpenSlotInput,
} from "@/lib/appointments/calendar-waitlist-slot-match-pure";

export type { CalendarOpenSlotInput };

export type CalendarWaitlistMatchRow = {
  entryId: string;
  contactLabel: string;
  preferenceSummary: string;
  staffPreferenceLabel?: string;
  score: number;
  rank: number;
};

function entryPreferenceSummary(entry: {
  preferredDate?: string | null;
  preferredTimeStart?: string | null;
  preferredTimeEnd?: string | null;
  staffPreference?: string | null;
}): string {
  const parts: string[] = [];
  if (entry.preferredDate) {
    const d = new Date(`${entry.preferredDate}T12:00:00`);
    parts.push(
      d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) +
        (entry.preferredTimeStart ? ` ${entry.preferredTimeStart}` : " afternoons"),
    );
  } else if (entry.preferredTimeStart || entry.preferredTimeEnd) {
    parts.push(`After ${entry.preferredTimeStart || entry.preferredTimeEnd}`);
  } else {
    parts.push("Any weekday");
  }
  return parts.join(" · ") || "Flexible";
}

async function slotCanonicallyBookable(
  workspaceId: string,
  serviceName: string,
  startsAt: string,
): Promise<boolean> {
  try {
    await assertSlotAvailableForBooking(workspaceId, { serviceName, startsAt });
    return true;
  } catch {
    return false;
  }
}

export async function matchWaitlistEntriesForCalendarSlot(
  input: CalendarOpenSlotInput,
): Promise<CalendarWaitlistMatchRow[]> {
  const prisma = getPrisma();
  const ranked = await rankWaitlistEntries(input.workspaceId);
  const rankMap = new Map(ranked.map((r, i) => [r.entryId, { rank: i + 1, score: r.score }]));

  const entries = await prisma.appointmentWaitlistEntry.findMany({
    where: { workspaceId: input.workspaceId, status: "active" },
    take: 200,
  });

  const serviceName = input.serviceName || "Appointment";
  const matches: CalendarWaitlistMatchRow[] = [];

  for (const entry of entries) {
    if (!entryMatchesWaitlistSlotPreferences(entry, input)) continue;
    const effectiveService = entry.serviceName || serviceName;
    const bookable = await slotCanonicallyBookable(
      input.workspaceId,
      effectiveService,
      input.startsAt,
    );
    if (!bookable) continue;

    const contact =
      entry.phone ||
      entry.email ||
      (entry.contactId ? `Client ${entry.contactId.slice(0, 8)}` : "Waitlist client");
    const rank = rankMap.get(entry.id);
    matches.push({
      entryId: entry.id,
      contactLabel: contact,
      preferenceSummary: entryPreferenceSummary(entry),
      staffPreferenceLabel: entry.staffPreference ? "Prefers staff" : "Any staff",
      score: rank?.score ?? 0,
      rank: rank?.rank ?? 999,
    });
  }

  matches.sort((a, b) => a.rank - b.rank);
  return matches;
}
