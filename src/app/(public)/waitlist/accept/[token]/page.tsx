import { PublicWaitlistAcceptConnected } from "@/features/appointments/kimi/public/public-waitlist-accept-connected";

type Props = { params: Promise<{ token: string }> };

export default async function WaitlistAcceptPage({ params }: Props) {
  const { token } = await params;
  return <PublicWaitlistAcceptConnected token={token} />;
}
