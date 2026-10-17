import { getPrisma } from "@/lib/db";
import { VisualizerPublicHostedPage } from "@/newui-transplant/connected/visualizer/visualizer-public-hosted-page";

export default async function EmbedVisualizerPage({
  params,
}: {
  params: Promise<{ publicKey: string }>;
}) {
  const { publicKey } = await params;
  const prisma = getPrisma();
  const widget = await prisma.visualizerWidgetConfig.findFirst({
    where: { publicKey, published: true },
  });
  if (!widget) {
    return <p className="p-6 text-sm text-muted-foreground">Visualizer unavailable.</p>;
  }
  return <VisualizerPublicHostedPage slug={widget.publicSlug} />;
}
