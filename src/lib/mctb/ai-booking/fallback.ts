import { listMctbBookingLinks } from "@/lib/mctb/booking-links/service";

export async function getDefaultMctbBookingLink(workspaceId: string) {
  const links = await listMctbBookingLinks(workspaceId, true);
  return links.find((l) => l.isDefault) ?? links[0] ?? null;
}
