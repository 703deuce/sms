import { ClientPortalAppointmentDetail } from "@/components/client-portal/client-portal-appointment-detail";

type Props = { params: Promise<{ appointmentId: string }> };

export default async function ClientPortalAppointmentPage({ params }: Props) {
  const { appointmentId } = await params;
  return <ClientPortalAppointmentDetail appointmentId={appointmentId} />;
}
