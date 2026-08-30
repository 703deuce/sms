import { KimiPreviewClient } from "@/components/transovo/kimi/preview-client";

export default async function TransovoKimiPreviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <KimiPreviewClient sessionId={sessionId} />;
}
