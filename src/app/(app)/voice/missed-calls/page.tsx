import { CrossProductBanner } from "@/components/products/cross-product-banner";
import { MctbMissedCallsView } from "@/components/mctb/missed-calls-view";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { getSession } from "@/lib/auth";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function VoiceMissedCallsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const session = await getSession();
  const productFeatures = await getWorkspaceProductFeatures(workspaceId, {
    isPlatformAdmin: session?.isAdmin,
  });
  const showMassSmsBanner = isActiveEntitlement(productFeatures.mass_texting);

  return (
    <div className="space-y-4">
      {showMassSmsBanner ? <CrossProductBanner variant="mass_sms_on_mctb" /> : null}
      <MctbMissedCallsView />
    </div>
  );
}
