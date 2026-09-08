import ClientPortalPublicClient from "@/components/appointments/client-portal-public-client";

type Params = { params: Promise<{ token: string }> };

export default async function Page({ params }: Params) {
  const { token } = await params;
  return <ClientPortalPublicClient token={token} />;
}
