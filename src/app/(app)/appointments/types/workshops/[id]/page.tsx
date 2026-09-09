import { ClassEditorConnected } from "@/components/appointments/classes/class-editor-connected";

type Props = { params: Promise<{ id: string }> };

export default async function EditWorkshopPage({ params }: Props) {
  const { id } = await params;
  return <ClassEditorConnected segmentId="workshops" typeId={id} />;
}
