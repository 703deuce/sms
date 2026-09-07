import { CrossProductBanner } from "@/components/products/cross-product-banner";
import { MctbMissedCallsView } from "@/components/mctb/missed-calls-view";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { getSession } from "@/lib/auth";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { Suspense } from "react";

export default async function MctbMissedCallsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const session = await getSession();
  const productFeatures = await getWorkspaceProductFeatures(workspaceId, {
    isPlatformAdmin: session?.isAdmin,
  });
  const showMassSmsBanner = isActiveEntitlement(productFeatures.mass_texting);

  return (
    <div className="space-y-4">
      {showMassSmsBanner ? <CrossProductBanner variant="mass_sms_on_mctb" /> : null}
      <Suspense fallback={<div className="px-6 py-12 text-sm text-muted-foreground">Loading missed calls…</div>}>
        <MctbMissedCallsView />
      </Suspense>
    </div>
  );
}
