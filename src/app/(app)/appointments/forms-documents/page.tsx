import { Suspense } from "react";
import { FormsDocumentsConnected } from "@/components/appointments/forms-documents/forms-documents-connected";

export default function FormsDocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <FormsDocumentsConnected />
    </Suspense>
  );
}
