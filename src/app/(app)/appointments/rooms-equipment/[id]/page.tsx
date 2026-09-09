import { RoomsEquipmentEditorConnected } from "@/components/appointments/rooms-equipment/rooms-equipment-editor-connected";

type Props = { params: Promise<{ id: string }> };

export default async function EditRoomsEquipmentPage({ params }: Props) {
  const { id } = await params;
  return <RoomsEquipmentEditorConnected resourceId={id} />;
}
