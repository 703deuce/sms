import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { loadParkedNumbers } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";

export default async function PersonalVaultPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const parked = await loadParkedNumbers(workspaceId);

  return (
    <div>
      <PageHeader
        title="Number Vault"
        description="Keep numbers at a low monthly cost without full service."
      />
      {parked.length === 0 ? (
        <EmptyState
          title="No parked numbers"
          description="Park a number you want to keep without forwarding or voicemail."
          actionLabel="Park Another Number"
          actionHref="/personal/numbers/find"
        />
      ) : (
        <ul className="space-y-3">
          {parked.map((n) => (
            <li key={n.id} className="surface flex flex-wrap items-center justify-between gap-4 rounded-xl p-4">
              <div>
                <p className="font-semibold">{formatPhone(n.number)}</p>
                <p className="text-sm text-muted-foreground">
                  Parked {n.parkedSince ? new Date(n.parkedSince).toLocaleDateString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Plan ${n.monthlyCost.toFixed(2)}/mo · Voicemail {n.voicemailEnabled ? "on" : "off"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/personal/forwarding?numberId=${n.id}`}>
                  <Button size="sm" variant="outline">Activate Forwarding</Button>
                </Link>
                <Link href={`/personal/voicemail?numberId=${n.id}`}>
                  <Button size="sm" variant="outline">Activate Voicemail</Button>
                </Link>
                <Link href={`/personal/porting?tab=out&numberId=${n.id}`}>
                  <Button size="sm" variant="outline">Port Away</Button>
                </Link>
                <Link href={`/personal/numbers/${n.id}`}>
                  <Button size="sm" variant="outline">Move to Business</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <Link href="/personal/numbers/find">
          <Button>Park Another Number</Button>
        </Link>
      </div>
    </div>
  );
}
