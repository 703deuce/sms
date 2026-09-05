import { RecapShareClient } from "@/components/meetings/recap-share-client";

type Props = { params: Promise<{ token: string }> };

export default async function PublicRecapSharePage({ params }: Props) {
  const { token } = await params;
  return <RecapShareClient token={token} />;
}
