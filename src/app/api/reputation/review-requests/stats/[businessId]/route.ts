import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadReviewRequestStats } from "@/lib/reputation/review-sends";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const stats = await loadReviewRequestStats(businessId, auth.organizationId);
    return NextResponse.json(stats);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load stats");
  }
}
