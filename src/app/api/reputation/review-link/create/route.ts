import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createOrRefreshReviewLink } from "@/lib/reputation/review-requests";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, forceRefresh } = body as {
      businessId?: string;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await createOrRefreshReviewLink({
      businessId,
      organizationId: auth.organizationId,
      forceRefresh,
    });

    return NextResponse.json(result);
  } catch (err) {
    return httpErrorFromException(err, "Failed to create review link");
  }
}
