import { VisualizerMaterialFormPage } from "@/newui-transplant/connected/visualizer/visualizer-material-form-page";

export default async function Page({ params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params;
  return <VisualizerMaterialFormPage materialId={materialId} />;
}
