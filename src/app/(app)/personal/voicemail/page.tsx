import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { PersonalVoicemailUI } from "@/components/personal/personal-voicemail-ui";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { hasMctbBundledVoicemailAccess } from "@/lib/products/feature-entitlements";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import Link from "next/link";

export default async function PersonalVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string; id?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const entitled = await hasMctbBundledVoicemailAccess(workspaceId, {
    isPlatformAdmin: session.isAdmin,
  });
  if (!entitled) {
    return <AddOnUpgradeCard feature="visual_voicemail" />;
  }
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId, id } = await searchParams;

  return (
    <div className="min-h-full bg-[#f6f7f8]">
      <div className="mx-auto flex max-w-[90rem] justify-end px-6 pt-4 lg:px-7">
        <Link
          href={MCTB_ROUTES.setupVoicemail}
          className="inline-flex h-9 items-center rounded-lg border border-[#dee2e6] bg-white px-4 text-[13px] font-medium text-[#1b1e23] hover:bg-[#fafbfc]"
        >
          Configure voicemail
        </Link>
      </div>
      <PersonalVoicemailUI numberId={numberId} numbers={numbers} initialMessageId={id} />
    </div>
  );
}
