import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { isDevPreviewBusiness } from "@/lib/auth/dev";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    if (isDevPreviewBusiness(businessId)) {
      return NextResponse.json({
        businessName: "Bright Smile Dental",
        businessId,
      });
    }

    const { requireBusinessAccess } = await import("@/lib/auth/api-auth");
    const { loadReviewRequestKit } = await import("@/lib/reputation/review-requests");
    const auth = await requireBusinessAccess(businessId);
    const data = await loadReviewRequestKit(businessId, auth.organizationId);
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load review request kit");
  }
}
