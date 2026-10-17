import { VisualizerProjectDetailPage } from "@/newui-transplant/connected/visualizer/visualizer-project-detail-page";

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <VisualizerProjectDetailPage projectId={projectId} />;
}
