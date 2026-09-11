import { Suspense } from "react";
import { FormDetailConnected } from "@/components/appointments/forms-documents/form-detail-connected";

type Props = { params: Promise<{ id: string }> };

export default async function FormDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <FormDetailConnected formId={id} />
    </Suspense>
  );
}
