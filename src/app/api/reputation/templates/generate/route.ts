import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  generateAndSaveTemplates,
  loadReviewRequestKit,
} from "@/lib/reputation/review-requests";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, tone } = body as { businessId?: string; tone?: string };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const rate = await assertRateLimit({
      key: `reputation-templates:${auth.organizationId}`,
      maxPerWindow: 25,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }
    const kit = await loadReviewRequestKit(businessId, auth.organizationId);

    if (!kit.link?.review_url) {
      return NextResponse.json(
        { error: kit.warning ?? "Create a review link first" },
        { status: 400 }
      );
    }

    const result = await generateAndSaveTemplates({
      businessId,
      organizationId: auth.organizationId,
      businessName: kit.businessName,
      reviewUrl: kit.link.review_url,
      keywordSuggestions: kit.keywordSuggestions.map((k) => String(k.keyword)),
      tone,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    return httpErrorFromException(err, "Failed to generate templates");
  }
}
