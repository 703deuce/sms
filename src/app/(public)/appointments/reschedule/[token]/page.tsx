import { PublicAppointmentActionClient } from "@/components/appointments/public-action-client";

type Props = { params: Promise<{ token: string }> };

export default async function RescheduleAppointmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicAppointmentActionClient kind="reschedule" token={token} />;
}
