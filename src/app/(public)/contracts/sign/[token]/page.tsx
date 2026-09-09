import ContractSignPublicClient from "@/components/appointments/contract-sign-public-client";

type Params = { params: Promise<{ token: string }> };

export default async function ContractSignPage({ params }: Params) {
  const { token } = await params;
  return <ContractSignPublicClient token={token} />;
}
