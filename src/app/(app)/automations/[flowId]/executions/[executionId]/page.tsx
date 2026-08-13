import { ExecutionDetailViewPanel } from "@/components/automations/execution-detail-view";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ flowId: string; executionId: string }>;
}) {
  const { flowId, executionId } = await params;
  const { workspaceId } = await requireWorkspaceContext();

  const execution = await getPrisma().automationExecution.findFirst({
    where: { id: executionId, flowId, workspaceId },
    select: { id: true },
  });
  if (!execution) notFound();

  return (
    <div className="space-y-4">
      <Link
        href={`/automations/${flowId}?tab=executions`}
        className="text-[12px] font-semibold text-[#4f46e5] hover:underline"
      >
        ← All executions
      </Link>
      <ExecutionDetailViewPanel flowId={flowId} executionId={executionId} />
    </div>
  );
}
