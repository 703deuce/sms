import Link from "next/link";
import { notFound } from "next/navigation";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { RetryFaxButton } from "@/components/fax/retry-fax-button";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getFaxTransmission } from "@/lib/fax/fax-service";
import { getFaxDocumentSignedUrl } from "@/lib/fax/fax-service";

export default async function FaxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const { id } = await params;
  const fax = await getFaxTransmission(workspaceId, id);
  if (!fax) notFound();

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
            {fax.fromE164} → {fax.toE164} · {fax.status}
          </p>
        </div>
        {fax.direction === "outbound" && fax.status === "failed" ? (
          <RetryFaxButton faxId={fax.id} />
        ) : null}
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
          {fax.intelligence.documentType ? (
            <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
              {fax.intelligence.documentType}
              {fax.intelligence.priority ? ` · ${fax.intelligence.priority}` : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      {fax.intelligence?.structuredDataJson ? (
        <section className="mt-6 rounded-lg border p-6">
          <h2 className="font-semibold">Extracted Data</h2>
          <pre className="mt-2 overflow-auto text-xs">
            {JSON.stringify(fax.intelligence.structuredDataJson, null, 2)}
          </pre>
        </section>
      ) : null}

      {fax.intelligence?.extractedText ? (
        <section className="mt-6 rounded-lg border p-6">
          <h2 className="font-semibold">Document Text</h2>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
            {fax.intelligence.extractedText}
          </pre>
        </section>
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/fax/inbox" className="text-primary hover:underline">
          ← Back to inbox
        </Link>
      </p>
    </div>
  );
}
