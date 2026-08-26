import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import { refreshMassTextingTrialState } from "@/lib/mass-texting/trial-lifecycle";
import { listMassTextPricingCards } from "@/lib/mass-texting/pricing";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await refreshMassTextingTrialState(auth.workspaceId);
    const summary = await getMassTextingBillingSummary(auth.workspaceId);
    return NextResponse.json({
      data: {
        summary,
        pricing: listMassTextPricingCards(),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
