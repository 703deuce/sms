import { ClassOccurrenceDetailConnected } from "@/components/appointments/classes/class-occurrence-detail-connected";

type Props = { params: Promise<{ id: string }> };

export default async function ClassOccurrenceDetailPage({ params }: Props) {
  const { id } = await params;
  return <ClassOccurrenceDetailConnected occurrenceId={id} />;
}
