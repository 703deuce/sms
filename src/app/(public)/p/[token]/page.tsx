import { redirect } from "next/navigation";

type Props = { params: Promise<{ token: string }> };

/** Customer-facing payment link — records open then redirects via API. */
export default async function PublicPaymentRequestPage({ params }: Props) {
  const { token } = await params;
  redirect(`/api/public/payment-requests/${encodeURIComponent(token)}`);
}
