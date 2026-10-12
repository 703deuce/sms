import { PublicManageConnected } from "@/features/appointments/kimi/public/public-manage-connected";

type Props = { params: Promise<{ token: string }> };

export default async function ManageAppointmentPage({ params }: Props) {
  const { token } = await params;
  return <PublicManageConnected token={token} />;
}
