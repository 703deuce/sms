import { StaffDetailConnected } from "@/components/appointments/staff/staff-detail-connected";

type Props = { params: Promise<{ staffId: string }> };

export default async function StaffDetailPage({ params }: Props) {
  const { staffId } = await params;
  return <StaffDetailConnected staffId={staffId} />;
}
