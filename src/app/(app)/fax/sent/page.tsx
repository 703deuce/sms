import Link from "next/link";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { listFaxTransmissions } from "@/lib/fax/fax-service";
import type { FaxTransmission } from "@prisma/client";

export default async function FaxSentPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const faxes = await listFaxTransmissions(workspaceId, { direction: "outbound", limit: 50 });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sent</h1>
      <div className="mt-6">
        <FaxSubnav />
      </div>
      {faxes.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No sent faxes yet.</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {faxes.map((fax: FaxTransmission) => (
            <li key={fax.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{fax.toE164}</p>
                <p className="text-muted-foreground">
                  {fax.status}
                  {fax.failureReason ? ` — ${fax.failureReason}` : ""}
                </p>
              </div>
              <Link href={`/fax/${fax.id}`} className="text-primary hover:underline">
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
