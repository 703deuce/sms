import { LocationDetailConnected } from "@/components/appointments/locations/location-detail-connected";

type Props = { params: Promise<{ locationId: string }> };

export default async function AppointmentLocationDetailPage({ params }: Props) {
  const { locationId } = await params;
  return <LocationDetailConnected locationId={locationId} />;
}
