import Link from "next/link";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getFaxUsageSnapshot } from "@/lib/fax/fax-usage";
import { getPrimaryFaxNumber } from "@/lib/fax/fax-number-provisioning";
import { listFaxTransmissions } from "@/lib/fax/fax-service";
import type { FaxTransmission, FaxIntelligence } from "@prisma/client";

type FaxListItem = FaxTransmission & { intelligence: FaxIntelligence | null };

export default async function FaxOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const usage = await getFaxUsageSnapshot(workspaceId);
  const number = await getPrimaryFaxNumber(workspaceId);
  const recent = await listFaxTransmissions(workspaceId, { limit: 5 });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fax</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send and receive faxes online with searchable AI document intelligence.
          </p>
        </div>
        <Link
          href="/fax/send"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Send Fax
        </Link>
      </div>
      <div className="mt-6">
        <FaxSubnav />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Fax number" value={number?.e164 || "Not provisioned"} />
        <Metric label="Plan" value={usage.tier} />
        <Metric
          label="Pages used"
          value={`${usage.pagesUsed} / ${usage.pagesIncluded}`}
        />
        <Metric label="Pages remaining" value={String(usage.pagesRemaining)} />
      </div>

      {!number ? (
        <div className="mt-6 rounded-lg border border-dashed p-6">
          <h2 className="font-semibold">Choose your fax number</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by area code and activate a dedicated fax line.
          </p>
          <Link href="/fax/numbers" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Set up fax number →
          </Link>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No faxes yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {recent.map((fax: FaxListItem) => (
              <li key={fax.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {fax.direction === "inbound" ? fax.fromE164 : fax.toE164}
                  </p>
                  <p className="text-muted-foreground">
                    {fax.direction} · {fax.status}
                    {fax.intelligence?.documentType ? ` · ${fax.intelligence.documentType}` : ""}
                  </p>
                </div>
                <Link href={`/fax/${fax.id}`} className="text-primary hover:underline">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
