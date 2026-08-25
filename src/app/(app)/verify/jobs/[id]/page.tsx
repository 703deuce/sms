import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifySubnav } from "@/components/verify/verify-subnav";
import { VerifyJobActions } from "@/components/verify/verify-job-actions";
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

  const failedCount = await prisma.verifyBulkJobRow.count({
    where: { bulkJobId: id, workspaceId, status: "failed" },
  });

  const exports = [
    { filter: "all", label: "Full enriched CSV" },
    { filter: "mobile", label: "Mobile numbers only" },
    { filter: "landline", label: "Landline only" },
    { filter: "fixed_voip", label: "Fixed VoIP only" },
    { filter: "non_fixed_voip", label: "Non-fixed VoIP only" },
    { filter: "voip", label: "All VoIP" },
    { filter: "toll_free", label: "Toll-free" },
    { filter: "invalid", label: "Invalid format" },
    { filter: "unknown", label: "Unknown" },
    { filter: "error", label: "Lookup errors" },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <VerifySubnav />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Job results</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {job.status} · {job.successfulLookups} verified · {job.failedLookups} failed
      </p>

      <div className="mt-4 rounded-lg border p-4 text-sm">
        <p>Uploaded rows: {job.totalRows.toLocaleString()}</p>
        <p>Unique phone numbers: {job.uniqueNumbers.toLocaleString()}</p>
        <p>Duplicates skipped: {job.duplicateRows.toLocaleString()}</p>
        <p>Credits required: {job.creditsReserved.toLocaleString()}</p>
        {job.errorMessage ? (
          <p className="mt-2 text-muted-foreground">{job.errorMessage}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {exports.map((e) => (
          <a
            key={e.filter}
            href={`/api/verify/jobs/${job.id}/export?filter=${e.filter}`}
            className="rounded-md border px-3 py-1.5 text-sm font-medium"
          >
            {e.label}
          </a>
        ))}
      </div>

      <div className="mt-4">
        <VerifyJobActions jobId={job.id} failedCount={failedCount} />
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Source CSV and exports are private to your organization. Delete the job to remove stored
        results according to retention policy.
      </p>

      <p className="mt-4 text-sm">
        <Link href="/verify/jobs" className="text-primary hover:underline">
          ← All jobs
        </Link>
      </p>
    </div>
  );
}
