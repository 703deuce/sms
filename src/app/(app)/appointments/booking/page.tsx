import { AppointmentBookingSettingsClient } from "@/components/appointments/booking-settings-client";
import { getPrisma } from "@/lib/db";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function AppointmentBookingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, name: true, displayName: true },
  });

  return (
    <AppointmentBookingSettingsClient
      workspaceSlug={ws?.slug || ""}
      workspaceName={ws?.displayName || ws?.name || "Your business"}
    />
  );
}
