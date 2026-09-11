import { ClientDetailConnected } from "@/components/appointments/clients/client-detail-connected";

type Props = { params: Promise<{ clientId: string }> };

export default async function AppointmentsClientDetailPage({ params }: Props) {
  const { clientId } = await params;
  return <ClientDetailConnected clientId={clientId} />;
}
