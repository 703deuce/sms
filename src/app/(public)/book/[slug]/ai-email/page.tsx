import { PublicEmailAiBookingClient } from "@/components/appointments/public-email-ai-booking-client";

type Props = { params: Promise<{ slug: string }> };

export default async function PublicEmailAiBookingPage({ params }: Props) {
  const { slug } = await params;
  return <PublicEmailAiBookingClient slug={slug} />;
}
