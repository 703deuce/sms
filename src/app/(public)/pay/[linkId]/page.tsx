import PublicPaymentLinkClient from "@/components/appointments/public-payment-link-client";

type Props = { params: Promise<{ linkId: string }> };

export default async function PublicPaymentLinkPage({ params }: Props) {
  const { linkId } = await params;
  return <PublicPaymentLinkClient linkId={linkId} />;
}
