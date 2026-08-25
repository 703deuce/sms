import { FaxNumberSetup } from "@/components/fax/fax-number-setup";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { listFaxNumbers } from "@/lib/fax/fax-number-provisioning";
import type { FaxNumber } from "@prisma/client";

export default async function FaxNumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await listFaxNumbers(workspaceId);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Fax Numbers</h1>
      <div className="mt-6">
        <FaxSubnav />
      </div>
      {numbers.length > 0 ? (
        <ul className="mt-6 divide-y rounded-lg border">
          {numbers.map((n: FaxNumber) => (
            <li key={n.id} className="px-4 py-3 text-sm">
              <p className="font-medium">{n.e164}</p>
              <p className="text-muted-foreground">{n.label} · {n.status}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6">
        <FaxNumberSetup />
      </div>
    </div>
  );
}
