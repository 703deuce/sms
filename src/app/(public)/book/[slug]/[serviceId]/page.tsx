import { PublicBookingServiceConnected } from "@/features/appointments/kimi/public/public-booking-service-connected";

type Props = { params: Promise<{ slug: string; serviceId: string }> };

export default async function PublicBookServicePage({ params }: Props) {
  const { slug, serviceId } = await params;
  return <PublicBookingServiceConnected slug={slug} initialServiceId={serviceId} />;
}
