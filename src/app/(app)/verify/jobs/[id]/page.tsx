import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifySubnav } from "@/components/verify/verify-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrisma } from "@/lib/db";

export default async function VerifyJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const { id } = await params;
  const prisma = getPrisma();
  const job = await prisma.verifyBulkJob.findFirst({ where: { id, workspaceId } });
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <VerifySubnav />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Job results</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {job.status} · {job.successfulLookups} successful · {job.failedLookups} failed
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`/api/verify/jobs/${job.id}/export?filter=all`}
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Download enriched CSV
        </a>
        <a
          href={`/api/verify/jobs/${job.id}/export?filter=mobile`}
          className="rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          Mobile only
        </a>
      </div>
      <p className="mt-8 text-sm">
        <Link href="/verify/jobs" className="text-primary hover:underline">
          ← All jobs
        </Link>
      </p>
    </div>
  );
}
