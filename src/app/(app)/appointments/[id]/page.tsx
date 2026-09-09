import { AppointmentDetailClient } from "@/components/appointments/detail-client";
import { PosCartAdminClient } from "@/components/appointments/pos-cart-admin-client";

type Props = { params: Promise<{ id: string }> };

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  if (id === "pos") {
    return <PosCartAdminClient />;
  }
  return (
    <div className="px-6 py-6 lg:px-8">
      <AppointmentDetailClient appointmentId={id} />
    </div>
  );
}
