import { PublicAppointmentActionClient } from "@/components/appointments/public-action-client";

type Props = { params: Promise<{ token: string }> };

export default async function ConfirmAppointmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicAppointmentActionClient kind="confirm" token={token} />;
}
