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
      const { REVIEWS_PREVIEW_DATA } = await import("@/lib/reviews/reviews-preview-data");
      return NextResponse.json({ ...REVIEWS_PREVIEW_DATA, businessId });
    }

    const { requireBusinessAccess } = await import("@/lib/auth/api-auth");
    const { loadReviewsPageData } = await import("@/lib/reviews/reviews-page-data");
    await requireBusinessAccess(businessId);
    const data = await loadReviewsPageData(businessId);
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load reviews");
  }
}
