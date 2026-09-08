import ManageAppointmentPage from "@/components/appointments/manage-appointment-public-client";

type Params = { params: Promise<{ token: string }> };

export default async function Page({ params }: Params) {
  const { token } = await params;
  return <ManageAppointmentPage token={token} />;
}
