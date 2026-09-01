import Link from "next/link";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { listFaxTransmissions } from "@/lib/fax/fax-service";
import type { FaxTransmission, FaxIntelligence } from "@prisma/client";

type FaxListItem = FaxTransmission & { intelligence: FaxIntelligence | null };

export default async function FaxInboxPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const faxes = await listFaxTransmissions(workspaceId, { direction: "inbound", folder: "inbox", limit: 50 });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <div className="mt-6">
        <FaxSubnav />
      </div>
      {faxes.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No received faxes yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {faxes.map((fax: FaxListItem) => (
            <li key={fax.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{fax.fromE164 || "Unknown sender"}</p>
                  <p className="text-sm text-muted-foreground">
                    {fax.pageCount || "?"} pages · {fax.status}
                    {fax.intelligence?.priority && fax.intelligence.priority !== "normal"
                      ? ` · ${fax.intelligence.priority.toUpperCase()}`
                      : ""}
                  </p>
                  {fax.intelligence?.aiSummary ? (
                    <p className="mt-2 text-sm">{fax.intelligence.aiSummary}</p>
                  ) : null}
                </div>
                <Link href={`/fax/${fax.id}`} className="text-sm text-primary hover:underline">
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
