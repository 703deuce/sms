import { PublicCancelConnected } from "@/features/appointments/kimi/public/public-cancel-connected";

type Props = { params: Promise<{ token: string }> };

export default async function CancelAppointmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicCancelConnected token={token} />;
}
