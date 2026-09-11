import { ClientPortalLogin } from "@/components/client-portal/client-portal-login";

type Props = { params: Promise<{ slug: string }> };

export default async function ClientPortalSlugLoginPage({ params }: Props) {
  const { slug } = await params;
  return <ClientPortalLogin slug={slug} />;
}
