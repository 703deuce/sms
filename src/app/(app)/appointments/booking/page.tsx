import { BookingPagesShell } from "@/components/appointments/booking/booking-pages-shell";
import { getPrisma } from "@/lib/db";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function AppointmentBookingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, name: true, displayName: true },
  });
  const types = await listAppointmentTypes(workspaceId);

  return (
    <BookingPagesShell
      workspaceSlug={ws?.slug || ""}
      workspaceName={ws?.displayName || ws?.name || "Your business"}
      types={types.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))}
    />
  );
}
