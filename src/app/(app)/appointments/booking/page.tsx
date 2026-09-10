import { AppointmentBookingSettingsClient } from "@/components/appointments/booking-settings-client";
import { BookingShareHubClient } from "@/components/appointments/booking-share-hub-client";
import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";
import { BookingPagesSubnav } from "@/components/appointments/booking-pages-subnav";
import { getPrisma } from "@/lib/db";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { listAppointmentTypes } from "@/lib/appointments/booking-platform";

type Props = {
  searchParams: Promise<{ section?: string }>;
};

export default async function AppointmentBookingPage({ searchParams }: Props) {
  const { section } = await searchParams;
  const { workspaceId } = await requireWorkspaceContext();
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, name: true, displayName: true },
  });
  const workspaceSlug = ws?.slug || "";
  const workspaceName = ws?.displayName || ws?.name || "Your business";

  if (section === "share") {
    const types = await listAppointmentTypes(workspaceId);
    return (
      <div className="px-6 py-6 lg:px-8 space-y-4">
        <BookingPagesSubnav />
        <BookingShareHubClient
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          types={types.map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          }))}
        />
      </div>
    );
  }

  if (section === "branding") {
    return (
      <div className="px-6 py-6 lg:px-8 space-y-4">
        <BookingPagesSubnav />
        <ServiceBookingAdminClient initialSection="theme" title="Booking appearance" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-6 pt-6 lg:px-8">
        <BookingPagesSubnav />
      </div>
      <AppointmentBookingSettingsClient workspaceSlug={workspaceSlug} workspaceName={workspaceName} />
    </div>
  );
}
