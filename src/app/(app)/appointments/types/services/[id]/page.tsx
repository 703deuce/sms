import { ServiceEditorConnected } from "@/components/appointments/services/service-editor-connected";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditServicePage({ params }: Props) {
  const { id } = await params;
  return <ServiceEditorConnected serviceId={id} />;
}
