import Link from "next/link";
import { VerifySubnav } from "@/components/verify/verify-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getVerifyCreditBalance } from "@/lib/verify/verify-credits";
import { getPrisma } from "@/lib/db";
import type { VerifyBulkJob } from "@prisma/client";

export default async function VerifyOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const balance = await getVerifyCreditBalance(workspaceId);
  const prisma = getPrisma();
  const jobs = await prisma.verifyBulkJob.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Verify</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clean and verify phone lists with carrier and line-type lookup.
      </p>
      <div className="mt-6">
        <VerifySubnav />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase text-muted-foreground">Available credits</p>
          <p className="mt-1 text-2xl font-semibold">{balance.toLocaleString()}</p>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/verify/single" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Verify a Number
        </Link>
        <Link href="/verify/bulk" className="rounded-md border px-4 py-2 text-sm font-semibold">
          Upload a List
        </Link>
      </div>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Recent jobs</h2>
        {jobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No bulk jobs yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {jobs.map((job: VerifyBulkJob) => (
              <li key={job.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{job.filename || job.id}</p>
                  <p className="text-muted-foreground">
                    {job.status} · {job.creditsConsumed} credits
                  </p>
                </div>
                <Link href={`/verify/jobs/${job.id}`} className="text-primary hover:underline">
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
