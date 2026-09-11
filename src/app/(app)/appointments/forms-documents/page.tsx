import { Suspense } from "react";
import { FormsDocumentsClient } from "@/components/appointments/forms-documents-client";

export default function FormsDocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading forms…</div>}>
      <FormsDocumentsClient />
    </Suspense>
  );
}
