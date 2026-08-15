import {
  MoveToBusinessClient,
  PortAwayWindowBanner,
} from "@/components/personal/personal-pages";
import { KeepWithTransovoButton, PersonalParkButton } from "@/components/personal/personal-action-buttons";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { deriveAcquisitionType } from "@/lib/workspace/personal-service";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  loadBusinessWorkspacesForUser,
  loadPersonalNumber,
} from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PersonalNumberDetailPage({
  params,
}: {
  params: Promise<{ numberId: string }>;
}) {
  const { numberId } = await params;
  const { workspaceId, session } = await requireWorkspaceContext();
  const number = await loadPersonalNumber(workspaceId, numberId);
  if (!number) notFound();

  const businesses = await loadBusinessWorkspacesForUser(session.userId);
  const acquisition = deriveAcquisitionType(number);

  return (
    <div className="space-y-6">
      <PageHeader title={formatPhone(number.number)} description="Manage this number" />
      <PortAwayWindowBanner number={number} />

      <section className="surface rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-semibold">Number</h2>
        <p className="text-sm">{formatPhone(number.number)}</p>
        <p className="text-sm text-muted-foreground">Workspace: Personal</p>
        <p className="text-sm text-muted-foreground">Status: {number.status}</p>
        <p className="text-sm text-muted-foreground">Acquisition: {acquisition}</p>
      </section>

      <section className="surface rounded-xl p-5 space-y-2">
        <h2 className="text-sm font-semibold">Current service</h2>
        <p className="text-sm">{number.serviceLabel}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <PersonalParkButton numberId={number.id} label="Park" />
          <Link href={`/personal/forwarding?numberId=${number.id}`}>
            <Button size="sm" variant="outline">Forwarding</Button>
          </Link>
          <Link href={`/personal/voicemail?numberId=${number.id}`}>
            <Button size="sm" variant="outline">Voicemail</Button>
          </Link>
        </div>
      </section>

      {number.voiceForwardTo ? (
        <section className="surface rounded-xl p-5">
          <h2 className="text-sm font-semibold">Forwarding</h2>
          <p className="text-sm text-muted-foreground">
            Forwarding to {formatPhone(number.voiceForwardTo)}
          </p>
        </section>
      ) : null}

      <section className="surface rounded-xl p-5">
        <h2 className="text-sm font-semibold">Voicemail</h2>
        <p className="text-sm text-muted-foreground">
          {number.voicemailEnabled ? "Enabled" : "Disabled"}
        </p>
        <Link href={`/personal/voicemail?numberId=${number.id}`} className="text-sm font-medium text-primary">
          Open voicemail inbox
        </Link>
      </section>

      <section className="surface rounded-xl p-5">
        <h2 className="text-sm font-semibold">Porting</h2>
        <p className="text-sm text-muted-foreground">{number.serviceLabel}</p>
        <Link href={`/personal/porting?numberId=${number.id}`} className="text-sm font-medium text-primary">
          View porting
        </Link>
      </section>

      <section className="surface rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">Move to Business</h2>
        <p className="text-sm text-muted-foreground">
          Keep the same number — reassign it to a business workspace on your account.
        </p>
        <MoveToBusinessClient numberId={number.id} businesses={businesses} />
      </section>

      <section className="surface rounded-xl border border-rose-100 p-5">
        <h2 className="text-sm font-semibold text-rose-700">Release number</h2>
        <p className="text-sm text-muted-foreground">
          Releasing returns the number to the carrier. This cannot be undone.
        </p>
        <Button size="sm" variant="outline" className="mt-2" disabled>
          Release number (confirm flow coming)
        </Button>
      </section>
    </div>
  );
}
