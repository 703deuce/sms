import { ResourceDetailConnected } from "@/components/appointments/resources/resource-detail-connected";

type Props = { params: Promise<{ resourceId: string }> };

export default async function AppointmentResourceDetailPage({ params }: Props) {
  const { resourceId } = await params;
  return <ResourceDetailConnected resourceId={resourceId} />;
}
