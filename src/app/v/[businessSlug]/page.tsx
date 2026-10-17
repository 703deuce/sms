import { VisualizerPublicHostedPage } from "@/newui-transplant/connected/visualizer/visualizer-public-hosted-page";

export default async function Page({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  return <VisualizerPublicHostedPage slug={businessSlug} />;
}
