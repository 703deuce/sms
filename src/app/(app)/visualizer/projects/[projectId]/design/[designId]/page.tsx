import { VisualizerDesignPage } from "@/newui-transplant/connected/visualizer/visualizer-design-page";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; designId: string }>;
}) {
  const { projectId, designId } = await params;
  return <VisualizerDesignPage projectId={projectId} designId={designId} />;
}
