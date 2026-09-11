import { PackageEditorConnected } from "@/components/appointments/packages/package-editor-connected";

type Props = { params: Promise<{ id: string }> };

export default async function PackageEditorPage({ params }: Props) {
  const { id } = await params;
  return <PackageEditorConnected packageId={id} />;
}
