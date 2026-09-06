import { PublicWaitlistAcceptClient } from "@/components/appointments/public-waitlist-accept-client";

type Props = { params: Promise<{ token: string }> };

export default async function WaitlistAcceptPage({ params }: Props) {
  const { token } = await params;
  return <PublicWaitlistAcceptClient token={token} />;
}
