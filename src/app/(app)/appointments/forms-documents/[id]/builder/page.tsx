import { Suspense } from "react";
import { FormBuilderPageClient } from "@/components/appointments/forms-documents/form-builder-page-client";

type Props = { params: Promise<{ id: string }> };

export default async function FormBuilderPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading builder…</div>}>
      <FormBuilderPageClient formId={id} />
    </Suspense>
  );
}
