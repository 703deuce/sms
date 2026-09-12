import { MctbBookingSetupConnected } from "@/features/mctb/booking/booking-setup/mctb-booking-setup-connected";

type Props = { params: Promise<{ id: string }> };

export default async function MctbBookingTypePage({ params }: Props) {
  const { id } = await params;
  return <MctbBookingSetupConnected meetingId={id} />;
}
