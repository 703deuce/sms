import { UiStudioPreviewClient } from "@/components/dev/ui-studio-preview-client";
import { isUiStudioEnabled } from "@/lib/ui-agent/dev-gate";
import { notFound } from "next/navigation";

export default async function DevUiStudioPreviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (!isUiStudioEnabled()) {
    notFound();
  }
  const { sessionId } = await params;
  return <UiStudioPreviewClient sessionId={sessionId} />;
}
