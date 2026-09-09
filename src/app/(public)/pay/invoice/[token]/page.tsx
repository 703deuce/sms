import InvoicePayPublicClient from "@/components/payments/invoice-pay-public-client";

type Params = { params: Promise<{ token: string }> };

export default async function InvoicePayPage({ params }: Params) {
  const { token } = await params;
  return <InvoicePayPublicClient token={token} />;
}
