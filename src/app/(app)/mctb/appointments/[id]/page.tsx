import { AppointmentDetailClient } from "@/components/appointments/detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function MctbAppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="mctb-booking-shell px-4 py-6 lg:px-8">
      <AppointmentDetailClient appointmentId={id} />
    </div>
  );
}
