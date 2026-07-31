import { FormEditor } from "@/components/forms/form-editor";

export default async function GrowFormEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FormEditor formId={id} />;
}
