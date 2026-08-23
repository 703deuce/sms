import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestReputationAudit } from "@/lib/reputation/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const data = await loadLatestReputationAudit(businessId);
    if (!data) {
      return NextResponse.json({
        audit: null,
        reviews: [],
        targetReviews: [],
        competitors: [],
        keywordGaps: [],
        tasks: [],
      });
    }
    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load reputation audit");
  }
}
