import "server-only";

import { getPrisma } from "@/lib/db";
import type { BookingSource } from "./types";

export function parseBookingSourceFromRequest(input: {
  referrer?: string;
  utm?: Record<string, string>;
  channel?: string;
}): BookingSource {
  if (input.channel === "mctb") return "mctb";
  if (input.channel === "ai") return "ai_booking";
  if (input.channel === "staff") return "staff_created";
  if (input.channel === "portal") return "client_portal";
  if (input.channel === "api") return "api";
  if (input.referrer?.includes("embed")) return "embedded";
  if (input.utm?.utm_campaign) return "campaign";
  if (input.channel === "direct") return "direct_link";
  return "public_page";
}

export function attachBookingSourceMetadata(
  metadata: Record<string, unknown>,
  source: BookingSource,
  utm?: Record<string, string>,
) {
  return {
    ...metadata,
    bookingSource: source,
    utm: utm || metadata.utm,
  };
}

export async function loadBookingSourceReport(workspaceId: string, from: Date, to: Date) {
  const prisma = getPrisma();
  const rows = await prisma.voiceAppointment.findMany({
    where: { workspaceId, createdAt: { gte: from, lte: to } },
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const meta = (row.metadata || {}) as { bookingSource?: string; source?: string };
    const key = meta.bookingSource || meta.source || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return { total: rows.length, bySource: counts };
}
