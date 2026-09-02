import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { assertWorkspaceMessagingSendAllowed } from "@/lib/messaging/unified-send-gate";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import { getSegmentAvailability } from "@/lib/mass-texting/credit-accounting";
import {
  refreshMassTextingSendState,
  syncMassTextingSendStateFromTelnyx,
} from "@/lib/mass-texting/send-readiness";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const syncTelnyx = new URL(request.url).searchParams.get("sync") === "telnyx";
    if (syncTelnyx) {
      await syncMassTextingSendStateFromTelnyx(auth.workspaceId);
    } else {
      await refreshMassTextingSendState(auth.workspaceId);
    }

    const [registration, billing, credits, a2p] = await Promise.all([
      getRegistrationByWorkspace(auth.workspaceId),
      getMassTextingBillingSummary(auth.workspaceId),
      getSegmentAvailability(auth.workspaceId),
      assertWorkspaceMessagingSendAllowed(auth.workspaceId),
    ]);

    return NextResponse.json({
      data: {
        useCase: a2p.useCase,
        registration,
        billing,
        credits,
        a2pReady: a2p.allowed,
        sharedWithMctb: true,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
