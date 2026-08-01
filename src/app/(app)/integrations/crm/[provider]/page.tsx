import { CrmProviderClient } from "./crm-provider-client";

export default async function CrmProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  return <CrmProviderClient provider={provider} />;
}
