import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadReviewOverviewData } from "@/lib/reviews/review-overview-data";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    const data = await loadReviewOverviewData(businessId);
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load review overview");
  }
}
