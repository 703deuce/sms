import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  ensureMessagingProductRegistration,
  getMessagingProductRegistration,
} from "@/lib/mass-texting/messaging-registration";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import { refreshMassTextingSendState } from "@/lib/mass-texting/send-readiness";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    await refreshMassTextingSendState(auth.workspaceId);
    const registration = await getMessagingProductRegistration(
      auth.workspaceId,
      "MASS_TEXT_MARKETING",
    );
    const billing = await getMassTextingBillingSummary(auth.workspaceId);

    return NextResponse.json({
      data: {
        useCase: "MASS_TEXT_MARKETING",
        registration,
        billing,
        separateFromMctb: true,
        mctbConsentDoesNotAuthorizeBulk: true,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
