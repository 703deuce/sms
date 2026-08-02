import { redirect } from "next/navigation";
import { NativeProviderClient } from "./native-provider-client";

export default async function NativeProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  if (provider === "mailchimp") {
    redirect("/integrations/native");
  }
  return <NativeProviderClient provider={provider} />;
}
