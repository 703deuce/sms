import { VisualizerPublicSharePage } from "@/newui-transplant/connected/visualizer/visualizer-public-share-page";

export default async function Page({
  params,
}: {
  params: Promise<{ businessSlug: string; shareToken: string }>;
}) {
  const { businessSlug, shareToken } = await params;
  return <VisualizerPublicSharePage slug={businessSlug} token={shareToken} />;
}
