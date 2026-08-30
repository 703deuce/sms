import { UiReferencesClient } from "@/components/dev/ui-references-client";
import { isUiStudioEnabled } from "@/lib/ui-agent/dev-gate";
import { notFound } from "next/navigation";

export default function DevUiReferencesPage() {
  if (!isUiStudioEnabled()) {
    notFound();
  }
  return <UiReferencesClient />;
}
