import { PublicBookingClient } from "@/components/appointments/public-booking-client";

type Props = { params: Promise<{ slug: string; serviceId: string }> };

export default async function PublicBookServicePage({ params }: Props) {
  const { slug, serviceId } = await params;
  return <PublicBookingClient slug={slug} initialServiceId={serviceId} />;
}
