import { AppointmentDetailClient } from "@/components/appointments/detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-6">
      <AppointmentDetailClient appointmentId={id} />
    </div>
  );
}
