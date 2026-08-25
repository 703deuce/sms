import Link from "next/link";
import { notFound } from "next/navigation";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { RetryFaxButton } from "@/components/fax/retry-fax-button";
import { FaxDetailActions } from "@/components/fax/fax-detail-actions";
import { FaxLifecycleTimeline } from "@/components/fax/fax-lifecycle-timeline";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getFaxTransmission, getFaxDocumentSignedUrl } from "@/lib/fax/fax-service";
import { mapToFaxDisplayStatus } from "@/lib/fax/fax-status";
import { readPageAccounting } from "@/lib/fax/fax-pages";

export default async function FaxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const { id } = await params;
  const fax = await getFaxTransmission(workspaceId, id);
  if (!fax) notFound();

  const metadata = (fax.metadataJson || {}) as Record<string, unknown>;
  const displayStatus = mapToFaxDisplayStatus({
    status: String(metadata.displayStatus || fax.status),
    direction: fax.direction,
  });
  const pages = readPageAccounting(fax.metadataJson) || {
    documentPages: fax.pageCount || 0,
    billablePages: fax.pageCount || 0,
  };
  const canDownloadConfirmation =
    displayStatus === "delivered" || displayStatus === "received";

  let documentUrl: string | null = null;
  if (fax.documentStoragePath) {
    try {
      documentUrl = await getFaxDocumentSignedUrl(workspaceId, id);
    } catch {
      documentUrl = null;
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <FaxSubnav />
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {fax.direction === "inbound" ? "Received fax" : "Sent fax"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fax.fromE164} → {fax.toE164}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Document pages: {pages.documentPages} · Billable pages: {pages.billablePages}
          </p>
        </div>
        {fax.direction === "outbound" && fax.status === "failed" ? (
          <RetryFaxButton faxId={fax.id} />
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FaxLifecycleTimeline
          displayStatus={displayStatus}
          failureReason={fax.failureReason}
        />
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border p-4">
            <h2 className="font-semibold">Transmission record</h2>
            <dl className="mt-3 space-y-2">
              <Row label="Submitted" value={fax.sentAt?.toLocaleString() || fax.createdAt.toLocaleString()} />
              {fax.deliveredAt ? <Row label="Delivered" value={fax.deliveredAt.toLocaleString()} /> : null}
              {fax.receivedAt ? <Row label="Received" value={fax.receivedAt.toLocaleString()} /> : null}
              {fax.telnyxFaxId ? <Row label="Transmission ID" value={fax.telnyxFaxId} /> : null}
              <Row label="Transovo ID" value={fax.id} />
            </dl>
          </div>
          <FaxDetailActions
            faxId={fax.id}
            direction={fax.direction}
            fromE164={fax.fromE164}
            canDownloadConfirmation={canDownloadConfirmation}
          />
        </div>
      </div>

      {documentUrl ? (
        <div className="mt-6">
          <a href={documentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
            Download / view PDF
          </a>
        </div>
      ) : null}

      {fax.intelligence?.aiSummary ? (
        <section className="mt-8 rounded-lg border p-6">
          <h2 className="font-semibold">AI Summary</h2>
          <p className="mt-2 text-sm">{fax.intelligence.aiSummary}</p>
        </section>
      ) : null}

      <p className="mt-8 text-sm">
        <Link href={fax.folder === "spam" ? "/fax/spam" : "/fax/inbox"} className="text-primary hover:underline">
          ← Back
        </Link>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
