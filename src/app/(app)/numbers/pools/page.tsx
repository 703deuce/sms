import { SenderPoolsPanel } from "@/components/numbers/sender-pools-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { numberTabs } from "@/lib/number-tabs";
import { getPrisma } from "@/lib/db";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { AlertTriangle } from "lucide-react";

export default async function SenderPoolsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const prisma = getPrisma();
  const [pools, numbers] = await Promise.all([
    prisma.senderPool.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }) as Promise<
      Array<{
        id: string;
        name: string;
        description: string | null;
        phoneNumberIds: string[];
        status: string;
      }>
    >,
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      select: { id: true, e164: true, friendlyName: true },
      orderBy: { e164: "asc" },
    }) as Promise<Array<{ id: string; e164: string; friendlyName: string | null }>>,
  ]);

  return (
    <div>
      <PageHeader
        title="Sender pools"
        description="Group numbers for high-volume sending with carrier-approved distribution."
      />
      <Tabs items={numberTabs} />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-medium text-amber-950">Do not rotate senders to evade filtering</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Sender pools distribute outbound volume across registered numbers for deliverability —
            not to bypass carrier blocks. All numbers in a pool must be registered to the same
            approved A2P campaign.
          </p>
        </div>
      </div>

      <SenderPoolsPanel
        initialPools={pools.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          phoneNumberIds: p.phoneNumberIds || [],
          status: p.status,
        }))}
        numbers={numbers}
      />
    </div>
  );
}
