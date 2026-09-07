import { PublicRescheduleConnected } from "@/features/appointments/kimi/public/public-reschedule-connected";

type Props = { params: Promise<{ token: string }> };

export default async function RescheduleAppointmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicRescheduleConnected token={token} />;
}
