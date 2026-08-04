import { MissedCallTextBackWizard } from "@/components/solutions/missed-call-text-back-wizard";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { loadShellData } from "@/lib/workspace-data";
import { redirect } from "next/navigation";

export default async function MissedCallTextBackSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ setupId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const { setupId } = await searchParams;
  const [initial, shell] = await Promise.all([
    loadMissedCallTextBack(workspaceId, setupId),
    loadShellData(session.userId, workspaceId),
  ]);

  return (
    <MissedCallTextBackWizard
      initial={initial}
      phoneNumbers={shell.phoneNumbers.map((n) => ({
        id: n.id,
        number: n.number,
        friendlyName: n.friendlyName,
      }))}
    />
  );
}
