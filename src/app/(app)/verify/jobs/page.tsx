import Link from "next/link";
import { VerifySubnav } from "@/components/verify/verify-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrisma } from "@/lib/db";
import type { VerifyBulkJob } from "@prisma/client";

export default async function VerifyJobsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const prisma = getPrisma();
  const jobs = await prisma.verifyBulkJob.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Verification Jobs</h1>
      <div className="mt-6">
        <VerifySubnav />
      </div>
      <ul className="mt-6 divide-y rounded-lg border">
        {jobs.map((job: VerifyBulkJob) => (
          <li key={job.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{job.filename || "CSV upload"}</p>
              <p className="text-muted-foreground">
                {job.processedRows}/{job.totalRows} rows · {job.status}
              </p>
            </div>
            <Link href={`/verify/jobs/${job.id}`} className="text-primary hover:underline">
              View
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
