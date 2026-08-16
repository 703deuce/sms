import { PersonalNumberDetailClient } from "@/components/personal/personal-number-detail-client";
import { PortAwayWindowBanner } from "@/components/personal/personal-pages";
import { PageHeader } from "@/components/ui/page-header";
import { deriveAcquisitionType } from "@/lib/workspace/personal-service";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import {
  loadBusinessWorkspacesForUser,
  loadPersonalNumber,
  loadPersonalNumberStats,
} from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
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
  const stats = await loadPersonalNumberStats(workspaceId, numberId);

  return (
    <div className="space-y-6">
      <PageHeader title={formatPhone(number.number)} description="Number hub" />
      <PortAwayWindowBanner number={number} />
      {stats ? (
        <PersonalNumberDetailClient
          number={number}
          stats={stats}
          acquisition={acquisition}
          businesses={businesses}
        />
      ) : null}
    </div>
  );
}
