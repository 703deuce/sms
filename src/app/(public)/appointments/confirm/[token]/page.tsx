import { PublicConfirmConnected } from "@/features/appointments/kimi/public/public-confirm-connected";

type Props = { params: Promise<{ token: string }> };

export default async function ConfirmAppointmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicConfirmConnected token={token} />;
}
