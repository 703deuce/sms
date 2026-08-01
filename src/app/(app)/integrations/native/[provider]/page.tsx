import { NativeProviderClient } from "./native-provider-client";

export default async function NativeProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  return <NativeProviderClient provider={provider} />;
}
