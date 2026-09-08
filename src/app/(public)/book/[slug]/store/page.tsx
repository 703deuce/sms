import { PublicStoreCheckoutClient } from "@/components/appointments/public-store-checkout-client";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicStorePage({ params }: Props) {
  const { slug } = await params;
  return <PublicStoreCheckoutClient slug={slug} />;
}
